# StoreIt Frontend - Next.js

This is the frontend application for StoreIt, built with Next.js 15 and designed to work with AWS backend services.

## Features

- **Authentication**: AWS Cognito integration
- **File Management**: Upload, download, delete, and share files
- **Modern UI**: Built with TailwindCSS and ShadCN/UI
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Server-side rendering with Next.js

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `env.example` to `.env.local` and fill in your AWS configuration:

```bash
cp env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_AWS_REGION`: Your AWS region
- `NEXT_PUBLIC_USER_POOL_ID`: Cognito User Pool ID
- `NEXT_PUBLIC_CLIENT_ID`: Cognito Client ID
- `NEXT_PUBLIC_API_GATEWAY_URL`: API Gateway URL

### 3. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 4. Build

```bash
npm run build
```

## Architecture

- **Framework**: Next.js 15 with App Router
- **Styling**: TailwindCSS with custom design system
- **UI Components**: ShadCN/UI with Radix UI
- **Authentication**: AWS Cognito
- **API**: AWS API Gateway + Lambda
- **File Storage**: AWS S3
- **Database**: AWS DynamoDB

## File Structure

```
frontend/
├── src/
│   ├── app/              # Next.js app router
│   ├── components/        # React components
│   ├── lib/              # Utilities and services
│   │   ├── actions/      # Server actions
│   │   └── aws/          # AWS configuration
│   ├── constants/         # App constants
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript types
├── public/               # Static assets
└── package.json
```

## Deployment

This frontend is designed to be deployed on Vercel:

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## Backend Integration

This frontend works with the AWS backend services:
- Lambda functions for API endpoints
- Cognito for authentication
- S3 for file storage
- DynamoDB for data persistence

## Development Notes

- The app uses server actions for API calls
- Authentication is handled through cookies
- File uploads use FormData with presigned URLs
- All API calls include JWT tokens for authentication 