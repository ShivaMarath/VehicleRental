variable "region" {
  default = "ap-south-1"
}
variable "app_instance_type" {
  default = "t3.medium"
}
variable "tools_instance_type" {
  default = "t3.large"
}
variable "public_key_path" {
  default = "~/.ssh/vehicle-rental.pub"
}
variable "private_key_path" {
  default = "~/.ssh/vehicle-rental"
}
variable "cloudshell_cidr" {
  description = "CloudShell public IP/32 (SSH from CloudShell)"
  type        = string
}
variable "laptop_cidr" {
  description = "Your laptop public IP/32 (Jenkins, SonarQube, Prometheus UIs)"
  type        = string
}
