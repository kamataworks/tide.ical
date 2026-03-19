# 潮まわりカレンダー | tide.ical

日本の潮まわり情報（大潮・中潮・小潮・長潮・若潮）をICS形式で生成するツールです。

## 開発

### 前提条件

- [Bun](https://bun.sh/) がインストールされていること

### ローカル実行

```bash
# 依存関係のインストール
bun install

# ICSファイル生成
bun run ushio.ts

# 気象庁サイトから潮位表ダウンロード
bun run download.ts
```

生成されたICSファイルは `./build/ushio.ics` に保存されます。

## 生成期間

実行日を基準として：
- **開始日**: 3ヶ月前
- **終了日**: 24ヶ月後
- **合計**: 約27ヶ月分のデータ

## ライセンス

MIT License

---

## 管理者向けセクション / Administrator Section

このセクションは、tide.icalプロジェクトのインフラストラクチャをAWSにデプロイ・管理するための情報です。

### 前提条件

- [Terraform](https://www.terraform.io/downloads) >= 1.13
- AWS CLIの設定（適切な権限を持つIAMユーザー）
- 以下のAWSリソースへのアクセス権限:
  - S3（バケット作成・管理）
  - CloudFront（ディストリビューション作成・管理）
  - IAM（ポリシー・ロール作成）
  - Route 53（カスタムドメイン使用時のみ）
  - ACM（カスタムドメイン使用時のみ）

### インフラストラクチャ構成

```
tide.ical/
├── build/              # 生成されたICSファイルとWebサイト
└── terraform/          # インフラストラクチャ定義
    ├── main.tf         # プロバイダー設定
    ├── variables.tf    # 変数定義
    ├── locals.tf       # ローカル変数
    ├── frontend.tf     # S3 + CloudFront設定
    ├── acm.tf          # SSL証明書（カスタムドメイン用）
    └── route53.tf      # DNSレコード（カスタムドメイン用）
```

**デプロイされるAWSリソース:**
- S3バケット（静的Webサイトホスティング）
- CloudFront（CDN、日本国内のみアクセス可能）
- Route 53（カスタムドメイン用のAレコード）※オプション
- ACM証明書（CloudFront用HTTPS証明書、us-east-1リージョン）※オプション

### 初回セットアップ

#### 1. S3バックエンドの準備

Terraformの状態ファイルを管理するS3バケットを作成します。

```bash
# S3バケット作成（バケット名は一意である必要があります）
aws s3 mb s3://tide-ical-terraform-state --region ap-northeast-1
cd terraform
terraform init -backend-config=backend.tfvars
terraform plan
terraform apply
```

### ビルドとデプロイ

#### 1. ICSファイルとWebサイトの生成

```bash
# プロジェクトルートで実行
bun install
bun run ushio.ts
```

生成されたファイルは `./build/` ディレクトリに保存されます。

#### 2. S3へのアップロード

```bash
# S3バケット名を取得
BUCKET_NAME=$(cd terraform && terraform output -raw frontend_bucket)

# ファイルをアップロード
aws s3 sync ./build/ s3://${BUCKET_NAME}/ --delete

# CloudFrontのキャッシュを無効化
DISTRIBUTION_ID=$(cd terraform && terraform output -raw cloudfront_distribution_id)
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"
```

#### 3. デプロイスクリプト（推奨）

以下の内容を `scripts/deploy.sh` として保存:

```bash
#!/bin/bash
set -e

echo "Building tide.ical..."
bun run ushio.ts

echo "Getting S3 bucket name..."
cd terraform
BUCKET_NAME=$(terraform output -raw frontend_bucket)
DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id)
cd ..

echo "Uploading to S3: ${BUCKET_NAME}..."
aws s3 sync ./build/ s3://${BUCKET_NAME}/ --delete

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"

echo "Deployment complete!"
cd terraform && terraform output website_url && cd ..
```

使用方法:
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 日常的な運用

#### 環境の切り替え

```bash
# 現在のワークスペースを確認
terraform workspace show

# ワークスペース一覧
terraform workspace list

# ワークスペース切り替え
terraform workspace select production
```

#### インフラストラクチャの更新

```bash
cd terraform
terraform workspace select production
terraform plan    # 変更内容を確認
terraform apply   # 適用
```

#### リソースの削除

```bash
# 注意: すべてのリソースが削除されます
cd terraform
terraform workspace select production
terraform destroy
```

### トラブルシューティング

#### ACM証明書の検証が完了しない

カスタムドメインを使用する場合、ACM証明書のDNS検証が必要です。通常5〜10分で完了します。

```bash
# 検証レコードを確認
aws acm describe-certificate \
  --certificate-arn <証明書ARN> \
  --region us-east-1
```

#### CloudFrontのデプロイが遅い

CloudFrontディストリビューションの作成・更新には15〜30分かかることがあります。これは正常な動作です。

#### 地理的制限の変更

デフォルトでは日本国内のみアクセス可能です。変更する場合は `terraform.tfvars` を編集:

```hcl
geo_restriction_locations = ["JP", "US"]  # 日本とアメリカからアクセス可能
```

### セキュリティ考慮事項

1. **IAM権限の最小化**: デプロイ用のIAMユーザーには必要最小限の権限のみを付与
2. **Terraform状態ファイル**: S3バケットで暗号化とバージョニングを有効化
3. **カスタムドメイン**: HTTPS強制（CloudFrontの設定）
4. **地理的制限**: デフォルトで日本国内のみアクセス可能
