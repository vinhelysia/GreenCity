import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Exclude /api, /_next, static files with an extension, favicon and image assets
    "/((?!api|_next|.*\\..*).*)",
  ],
};
