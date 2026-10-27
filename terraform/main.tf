terraform {
  required_version = ">= 1.5"
  required_providers {
    aws   = { source = "hashicorp/aws", version = "~> 5.0" }
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

provider "aws" {
  region = var.region
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_key_pair" "deployer" {
  key_name   = "vehicle-rental-key"
  public_key = file(pathexpand(var.public_key_path))
}

# ---------------- Tools server: Jenkins + SonarQube ----------------
resource "aws_security_group" "tools" {
  name        = "rental-tools-sg"
  description = "Jenkins and SonarQube"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from CloudShell"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.cloudshell_cidr]
  }
  ingress {
    description = "Jenkins UI (laptop)"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.laptop_cidr]
  }
  ingress {
    description = "SonarQube UI (laptop)"
    from_port   = 9000
    to_port     = 9000
    protocol    = "tcp"
    cidr_blocks = [var.laptop_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "tools" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.tools_instance_type
  key_name               = aws_key_pair.deployer.key_name
  vpc_security_group_ids = [aws_security_group.tools.id]
  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }
  tags = {
    Name = "rental-tools"
  }
}

# ---------------- App server: k3s Kubernetes ----------------
resource "aws_security_group" "app" {
  name        = "rental-app-sg"
  description = "k3s node: app, Grafana, Prometheus"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from CloudShell and from the Jenkins server"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.cloudshell_cidr, "${aws_instance.tools.public_ip}/32"]
  }
  ingress {
    description = "App (NodePort)"
    from_port   = 30500
    to_port     = 30500
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "Grafana (NodePort)"
    from_port   = 30300
    to_port     = 30300
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "Prometheus (NodePort, laptop only)"
    from_port   = 30090
    to_port     = 30090
    protocol    = "tcp"
    cidr_blocks = [var.laptop_cidr]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.app_instance_type
  key_name               = aws_key_pair.deployer.key_name
  vpc_security_group_ids = [aws_security_group.app.id]
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }
  tags = {
    Name = "rental-app-k3s"
  }
}

# Ansible inventory, generated for you
resource "local_file" "ansible_inventory" {
  filename = "${path.module}/../ansible/inventory.ini"
  content  = <<-EOT
    [k8s]
    ${aws_instance.app.public_ip}

    [tools]
    ${aws_instance.tools.public_ip}

    [all:vars]
    ansible_user=ubuntu
    ansible_ssh_private_key_file=${pathexpand(var.private_key_path)}
    ansible_ssh_common_args='-o StrictHostKeyChecking=no'
  EOT
}
