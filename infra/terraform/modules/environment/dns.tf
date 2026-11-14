# Certificates: one regional certificate for the API load balancer, one in us-east-1 for the three
# CloudFront sites. Both are validated through the Route 53 zone.

resource "aws_acm_certificate" "api" {
  domain_name       = local.api_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate" "sites" {
  provider = aws.us_east_1

  domain_name               = local.site_domains.learner
  subject_alternative_names = [local.site_domains.teach, local.site_domains.support]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

locals {
  cert_validation_records = merge(
    { for o in aws_acm_certificate.api.domain_validation_options : o.domain_name => o },
    { for o in aws_acm_certificate.sites.domain_validation_options : o.domain_name => o },
  )
}

resource "aws_route53_record" "cert_validation" {
  for_each = toset(concat([local.api_domain], values(local.site_domains)))

  zone_id         = data.aws_route53_zone.root.zone_id
  name            = local.cert_validation_records[each.key].resource_record_name
  type            = local.cert_validation_records[each.key].resource_record_type
  records         = [local.cert_validation_records[each.key].resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [aws_route53_record.cert_validation[local.api_domain].fqdn]
}

resource "aws_acm_certificate_validation" "sites" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.sites.arn
  validation_record_fqdns = [for d in values(local.site_domains) : aws_route53_record.cert_validation[d].fqdn]
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.root.zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}
