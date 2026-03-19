resource "aws_s3_bucket" "frontend" {
  bucket = "content.tide.ical.kamataworks.com"
  tags   = local.common_tags
}

resource "aws_s3_bucket_policy" "bucket" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_policy.json
}

data "aws_iam_policy_document" "frontend_policy" {
  statement {
    sid    = "AllowCloudFront"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "content.tide.ical.kamataworks.com"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  http_version    = "http2"
  is_ipv6_enabled = true
  price_class     = var.cloudfront_price_class
  enabled         = true
  comment         = "[${local.env}] CDN for ${var.project_name} frontend"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = aws_s3_bucket.frontend.id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = aws_s3_bucket.frontend.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = var.min_ttl
    default_ttl            = var.default_ttl
    max_ttl                = var.max_ttl
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.common_tags
}

output "frontend_bucket" {
  description = "frontend origin"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_domain" {
  description = "cloudfront domain"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.frontend.id
}

output "website_url" {
  description = "Website URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}
