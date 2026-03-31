# 潮まわりカレンダー | tide.ical

日本の潮まわり情報（大潮・中潮・小潮・長潮・若潮）をICS形式で生成するツールです。

## 開発

### 前提条件

- [Bun](https://bun.sh/) がインストールされていること

### ローカル実行

```bash
# 依存関係のインストール
bun install

# 気象庁サイトから潮位データをダウンロード（choihyo/, choi/ に保存）
bun run download.ts

# 潮まわりカレンダー生成
bun run ushio.ts

# 満ち潮・引き潮カレンダー生成
bun run shioji.ts
```

生成されるファイル：

| ファイル/ディレクトリ | 内容 |
|---|---|
| `build/ushio.ics` | 潮まわりカレンダー（大潮・中潮・小潮・長潮・若潮） |
| `build/shioji/{stationCode}.ics` | 各観測点の満ち潮・引き潮期間カレンダー |
| `build/shioji-extrema/{stationCode}.ics` | 各観測点の満潮・干潮ピンポイントカレンダー |
| `build/shioji.json` | 観測点情報（ステーション名・緯度経度） |

## 生成期間

- **潮まわり（ushio.ts）**：実行日の3ヶ月前〜24ヶ月後（約27ヶ月分）
- **満ち潮・引き潮（shioji.ts）**：実行時の前年〜翌年の3年分（例：2026年3月実行なら2025〜2027年）

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
│   ├── ushio.ics
│   ├── shioji/         # 満ち潮・引き潮ICS（観測点別）
│   └── shioji-extrema/ # 満潮・干潮ICS（観測点別）
├── choi/               # ダウンロードした毎時潮位・極値データ（JSON）
├── choihyo/            # ダウンロードした潮汐調和定数表（JSON）
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
bun run download.ts
TZ=Asia/Tokyo bun run ushio.ts
TZ=Asia/Tokyo bun run shioji.ts
```

生成されたファイルは `./build/` ディレクトリに保存されます。

#### 2. S3へのアップロード

```bash
# S3バケット名を取得
BUCKET_NAME=$(cd terraform && terraform output -raw frontend_bucket)

# ファイルをアップロード
aws s3 sync ./build s3://${BUCKET_NAME}/ \
    --exclude "*.ics"
aws s3 sync ./build s3://${BUCKET_NAME}/ \
    --exclude "*" \
    --include "*.ics" \
    --content-type "text/calendar; charset=utf-8"
```
