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
}
