output "app_ip" {
  value = aws_instance.app.public_ip
}
output "tools_ip" {
  value = aws_instance.tools.public_ip
}
output "app_url" {
  value = "http://${aws_instance.app.public_ip}:30500"
}
output "grafana_url" {
  value = "http://${aws_instance.app.public_ip}:30300"
}
output "prometheus_url" {
  value = "http://${aws_instance.app.public_ip}:30090"
}
output "jenkins_url" {
  value = "http://${aws_instance.tools.public_ip}:8080"
}
output "sonarqube_url" {
  value = "http://${aws_instance.tools.public_ip}:9000"
}
