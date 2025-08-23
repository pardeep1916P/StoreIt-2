/// <reference types="node" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      NEXT_PUBLIC_APPWRITE_ENDPOINT: string;
      NEXT_PUBLIC_APPWRITE_PROJECT: string;
      NEXT_PUBLIC_APPWRITE_DATABASE: string;
      NEXT_PUBLIC_APPWRITE_USERS_COLLECTION: string;
      NEXT_PUBLIC_APPWRITE_FILES_COLLECTION: string;
      NEXT_PUBLIC_APPWRITE_BUCKET: string;
      NEXT_APPWRITE_KEY: string;
    }
  }
}

export {}; 