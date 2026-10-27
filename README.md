# Vehicle Rental - Full DevSecOps on AWS (CloudShell only)

React + Express/SQLite -> Docker -> Jenkins (SonarQube, OWASP Dependency-Check, OWASP ZAP)
-> Docker Hub -> Ansible -> k3s Kubernetes on EC2 (app + Prometheus + Grafana). Infra by Terraform.

Servers: app (k3s, t3.medium) and tools (Jenkins + SonarQube, t3.large).
See the chat instructions for the exact step-by-step commands.
