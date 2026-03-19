provider "aws" {
  region = "ap-northeast-1"
}

provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
}

terraform {
  backend "s3" {}

  required_version = ">= 1.13"

  required_providers {
    aws = {
      "source"  = "hashicorp/aws"
      "version" = "~> 6.19"
    }
  }
}

data "aws_caller_identity" "current" {}
