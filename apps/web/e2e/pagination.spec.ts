import { expect, test, type Page } from "@playwright/test";

type MockRequest = {
  path: string;
  query: Record<string, string>;
};
type MockReply = { status: number; json: unknown };
type MockHandler = (
  request: MockRequest,
) => MockReply | null | Promise<MockReply | null>;

const NOW = "2026-08-09T10:00:00.000Z";

function reply(json: unknown, status = 200): MockReply {
  return { status, json };
}

function listing(id: string, name: string) {
  return {
    id,
    categoryName: name,
    estimatedWeightKg: 2,
    buyerPricePerKgVnd: 1200,
    estimatedTotalVnd: 2400,
    priceBandMinVnd: 1000,
    priceBandMaxVnd: 1400,
    status: "AVAILABLE",
    mediaDownloadPath: `/marketplace/listings/${id}/photo`,
    isOwn: false,
    createdAt: NOW,
  };
}

function currentUser(role: "USER" | "ADMIN") {
  return {
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.test`,
      displayName: role,
      phone: null,
      roles: [role],
      status: "ACTIVE",
      createdAt: NOW,
    },
  };
}

function scrapRequest(id: string, name: string) {
  return {
    id,
    sellerId: "user-1",
    category: {
      id: "category-1",
      name,
      minPricePerKgVnd: 1000,
      maxPricePerKgVnd: 1400,
      active: true,
    },
    estimatedWeightKg: 2,
    media: {
      id: `media-${id}`,
      ownerId: "user-1",
      contentType: "image/jpeg",
      byteSize: 100,
      width: 10,
      height: 10,
      createdAt: NOW,
      downloadPath: `/media/media-${id}/content`,
    },
    note: null,
    status: "SUBMITTED",
    createdAt: NOW,
    activeQuote: null,
  };
}

/**
 * Keep the UI test hermetic: it exercises the same browser fetch boundary as
 * production but never starts from, or mutates, the development database.
 */
async function installApiMock(page: Page, handler: MockHandler): Promise<void> {
  await page.exposeFunction("__gcPaginationMock", async (request: MockRequest) => {
    const result = await handler(request);
    return result ? { status: result.status, body: JSON.stringify(result.json) } : null;
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const url = new URL(href, window.location.href);
      const handled = await (
        window as unknown as {
          __gcPaginationMock: (request: MockRequest) => Promise<{
            status: number;
            body: string;
          } | null>;
        }
      ).__gcPaginationMock({
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
      });
      if (!handled) return originalFetch(input, init);
      return new Response(handled.body, {
        status: handled.status,
        headers: { "Content-Type": "application/json" },
      });
    };
  });
}

test.describe("Cursor pagination UI @core", () => {
  test("marketplace appends a second page once while its Load more button is pending", async ({
    page,
  }) => {
    let releasePageTwo = () => {};
    const pageTwo = new Promise<void>((resolve) => {
      releasePageTwo = resolve;
    });
    let pageTwoCalls = 0;

    await installApiMock(page, async ({ path, query }) => {
      if (path === "/api/auth/me") {
        return reply({ error: { code: "UNAUTHORIZED", message: "anonymous" } }, 401);
      }
      if (path !== "/api/marketplace/listings") return null;
      if (!query.cursor) {
        return reply({
          listings: [listing("one", "Page one A"), listing("two", "Page one B")],
          nextCursor: "page-one-cursor",
        });
      }
      expect(query.cursor).toBe("page-one-cursor");
      pageTwoCalls += 1;
      await pageTwo;
      return reply({ listings: [listing("three", "Page two C")] });
    });

    await page.goto("/en/marketplace", { waitUntil: "networkidle" });
    const loadMore = page.getByTestId("marketplace-listings-load-more");
    await loadMore.click();

    await expect(loadMore).toBeDisabled();
    await expect.poll(() => pageTwoCalls).toBe(1);
    await expect(page.getByText("Page one A", { exact: true })).toBeVisible();
    await expect(page.getByText("Page one B", { exact: true })).toBeVisible();

    releasePageTwo();
    await expect(page.getByText("Page two C", { exact: true })).toBeVisible();
    await expect(page.getByText("Page one A", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Page one B", { exact: true })).toHaveCount(1);
    await expect(loadMore).toHaveCount(0);
    expect(pageTwoCalls).toBe(1);
  });

  test("marketplace keeps page one visible after a failed Load more and retries successfully", async ({
    page,
  }) => {
    let cursorCalls = 0;
    await installApiMock(page, ({ path, query }) => {
      if (path === "/api/auth/me") {
        return reply({ error: { code: "UNAUTHORIZED", message: "anonymous" } }, 401);
      }
      if (path !== "/api/marketplace/listings") return null;
      if (!query.cursor) {
        return reply({
          listings: [listing("one", "Retry page one")],
          nextCursor: "retry-cursor",
        });
      }
      cursorCalls += 1;
      if (cursorCalls === 1) {
        return reply({ error: { code: "UNKNOWN_ERROR", message: "private detail" } }, 503);
      }
      return reply({ listings: [listing("two", "Retry page two")] });
    });

    await page.goto("/en/marketplace", { waitUntil: "networkidle" });
    const loadMore = page.getByTestId("marketplace-listings-load-more");
    await loadMore.click();

    await expect(page.getByTestId("marketplace-listings-load-more-error")).toHaveText(
      "Unable to load more. Please try again.",
    );
    await expect(page.getByText("Retry page one", { exact: true })).toBeVisible();
    await expect(loadMore).toBeEnabled();

    await loadMore.click();
    await expect(page.getByText("Retry page two", { exact: true })).toBeVisible();
    await expect(page.getByText("Retry page one", { exact: true })).toHaveCount(1);
    expect(cursorCalls).toBe(2);
  });

  test("homepage asks the public listing endpoint for exactly four rows", async ({ page }) => {
    const listingLimits: string[] = [];
    await installApiMock(page, ({ path, query }) => {
      if (path === "/api/auth/me") {
        return reply({ error: { code: "UNAUTHORIZED", message: "anonymous" } }, 401);
      }
      if (path === "/api/stats") {
        return reply({
          availableListings: 0,
          verifiedCleanupReports: 0,
          scrapWeightKg: 0,
          totalPointsAwarded: 0,
        });
      }
      if (path === "/api/marketplace/listings") {
        listingLimits.push(query.limit ?? "");
        return reply({ listings: [] });
      }
      if (path === "/api/cleanup-reports/public") return reply({ reports: [] });
      return null;
    });

    await page.goto("/en", { waitUntil: "networkidle" });
    expect(listingLimits).toEqual(["4"]);
  });

  test("admin and seller use their own cursor-scoped listing endpoints", async ({ page }) => {
    let actor: "ADMIN" | "USER" = "ADMIN";
    let adminCursor = "";
    let mineCursor = "";
    await installApiMock(page, ({ path, query }) => {
      if (path === "/api/auth/me") return reply(currentUser(actor));
      if (path === "/api/admin/listings") {
        expect(query.status).toBe("RESERVED");
        adminCursor = query.cursor ?? "";
        return reply(
          query.cursor
            ? { listings: [listing("admin-two", "Admin page two")] }
            : {
                listings: [listing("admin-one", "Admin page one")],
                nextCursor: "admin-cursor",
              },
        );
      }
      if (path === "/api/scrap-categories") return reply({ categories: [] });
      if (path === "/api/scrap-requests/mine") {
        mineCursor = query.cursor ?? "";
        return reply(
          query.cursor
            ? { requests: [scrapRequest("seller-two", "Seller page two")] }
            : {
                requests: [scrapRequest("seller-one", "Seller page one")],
                nextCursor: "seller-cursor",
              },
        );
      }
      return null;
    });

    await page.goto("/en/admin/transactions", { waitUntil: "networkidle" });
    await page.getByTestId("admin-listings-load-more").click();
    await expect(page.getByText("Admin page two", { exact: true })).toBeVisible();
    expect(adminCursor).toBe("admin-cursor");

    actor = "USER";
    await page.goto("/en/sell-scrap", { waitUntil: "networkidle" });
    await page.getByTestId("my-scrap-requests-load-more").click();
    await expect(page.getByText("Seller page two", { exact: true })).toBeVisible();
    expect(mineCursor).toBe("seller-cursor");
  });
});
