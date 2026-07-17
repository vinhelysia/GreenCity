import { Global, Module } from '@nestjs/common';
import path from 'node:path';
import { loadEnv } from '../config/env';
import { LocalObjectStorage } from './local-object-storage';
import { S3ObjectStorageStub } from './s3-object-storage.stub';
import { OBJECT_STORAGE } from './storage.types';

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: () => {
        const env = loadEnv();
        if (env.STORAGE_DRIVER === 's3') {
          return new S3ObjectStorageStub({
            endpoint: env.S3_ENDPOINT,
            accessKey: env.S3_ACCESS_KEY,
            secretKey: env.S3_SECRET_KEY,
            bucket: env.S3_BUCKET,
            region: env.S3_REGION,
          });
        }
        const root = path.isAbsolute(env.STORAGE_LOCAL_DIR)
          ? env.STORAGE_LOCAL_DIR
          : path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
        return new LocalObjectStorage(root);
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
