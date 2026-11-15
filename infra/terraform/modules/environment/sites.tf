# Learner web, Teach and Support: static builds on S3 behind CloudFront.

locals {
  uploads_origin = "https://${aws_s3_bucket.uploads.bucket_regional_domain_name}"

  # What the three apps load: the API, the uploads bucket (presigned PUT/GET), Mux playback and
  # direct uploads, Google Fonts, and Stripe's hosted pages for redirects.
  content_security_policy = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: ${local.api_url} ${local.uploads_origin} https://image.mux.com",
    "media-src 'self' blob: ${local.api_url} ${local.uploads_origin} https://stream.mux.com",
    "connect-src 'self' ${local.api_url} ${local.uploads_origin} https://*.mux.com https://storage.googleapis.com",
    "worker-src 'self' blob:",
    "frame-src https://js.stripe.com https://checkout.stripe.com",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ])
}

# Private access: one function shared by the three distributions (see tailscale.tf).
resource "aws_cloudfront_function" "private_access" {
  count = var.private_access ? 1 : 0

  name    = "${local.prefix}-private-access"
  runtime = "cloudfront-js-2.0"
  comment = "403 unless the viewer comes through the Tailscale connector"
  publish = true
  code    = templatefile("${path.module}/templates/private-access.js.tftpl", { allowed_cidrs = local.private_access_cidrs })
}

module "site" {
  source   = "../static_site"
  for_each = local.site_domains

  providers = {
    aws = aws
  }

  name                    = "${local.prefix}-${each.key}"
  domain                  = each.value
  zone_id                 = data.aws_route53_zone.root.zone_id
  certificate_arn         = aws_acm_certificate_validation.sites.certificate_arn
  content_security_policy = local.content_security_policy
  csp_report_only         = var.csp_report_only
  force_destroy           = true # contents are build output; the deploy workflow recreates them

  # The connector only has IPv4; over IPv6 a device would reach CloudFront directly instead.
  ipv6_enabled                 = !var.private_access
  viewer_request_function_arns = aws_cloudfront_function.private_access[*].arn
}
