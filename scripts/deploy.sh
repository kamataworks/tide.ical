#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/terraform"

echo "==> Building tide.ical..."
cd "${REPO_ROOT}"
TZ=Asia/Tokyo bun run ushio.ts
TZ=Asia/Tokyo bun run shioji.ts

echo "==> Getting Terraform outputs..."
cd "${TERRAFORM_DIR}"
BUCKET_NAME=$(terraform output -raw frontend_bucket)
DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id)
cd "${REPO_ROOT}"

echo "==> Uploading to S3: ${BUCKET_NAME}..."
# aws s3 sync ./build/ "s3://${BUCKET_NAME}/" --delete

# echo "==> Invalidating CloudFront cache: ${DISTRIBUTION_ID}..."
# aws cloudfront create-invalidation \
#   --distribution-id "${DISTRIBUTION_ID}" \
#   --paths "/*"

# echo ""
# echo "==> Deployment complete!"
# cd "${TERRAFORM_DIR}" && terraform output website_url
