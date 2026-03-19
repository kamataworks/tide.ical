variable "project_name" {
  description = "Project identifier (tide-ical)"
  type        = string
  default     = "tide-ical"
}

variable "domain_name" {
  description = "Custom domain (e.g., tide.ical.kamataworks.com)"
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  type        = string
  default     = ""
}

variable "cloudfront_price_class" {
  type    = string
  default = "PriceClass_200"
}

variable "geo_restriction_locations" {
  type    = list(string)
  default = ["JP"]
}

variable "default_ttl" {
  type    = number
  default = 300
}

variable "max_ttl" {
  type    = number
  default = 86400
}

variable "min_ttl" {
  type    = number
  default = 0
}
