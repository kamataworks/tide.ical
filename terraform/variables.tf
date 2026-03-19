variable "project_name" {
  description = "Project identifier (tide-ical)"
  type        = string
  default     = "tide-ical"
}

variable "cloudfront_price_class" {
  type    = string
  default = "PriceClass_All"
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
