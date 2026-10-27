pipeline {
  agent any

  parameters {
    booleanParam(name: 'RUN_DEPCHECK', defaultValue: true,
                 description: 'Run OWASP Dependency-Check (needs nvd-api-key credential)')
  }

  environment {
    DOCKERHUB_USER   = 'shivamarath'              // <-- change this
    IMAGE            = "${DOCKERHUB_USER}/vehicle-rental"
    TAG              = "${env.BUILD_NUMBER}"
    APP_IP           = credentials('app-ip')            // Secret text
    GRAFANA_PASSWORD = credentials('grafana-password')  // Secret text
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Unit Tests') {
      steps { sh 'docker build --target test -t vehicle-rental-test .' }
    }

    stage('SonarQube Scan') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
            sh '''
              docker run --rm --network host --volumes-from jenkins -w "$WORKSPACE" \
                -e SONAR_TOKEN -e SONAR_HOST_URL=http://localhost:9000 \
                sonarsource/sonar-scanner-cli
            '''
          }
        }
      }
    }

    stage('OWASP Dependency-Check') {
      when { expression { params.RUN_DEPCHECK } }
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          withCredentials([string(credentialsId: 'nvd-api-key', variable: 'NVD_KEY')]) {
            sh '''
              mkdir -p reports
              docker run --rm --user root --volumes-from jenkins -w "$WORKSPACE" \
                owasp/dependency-check:latest \
                --scan backend --scan frontend \
                --project vehicle-rental --format HTML --format JSON \
                --out reports --data /var/jenkins_home/dc-data \
                --nvdApiKey "$NVD_KEY" --failOnCVSS 9
            '''
          }
        }
      }
    }

    stage('Build Image') {
      steps { sh 'docker build --target final -t $IMAGE:$TAG -t $IMAGE:latest .' }
    }

    stage('Push Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                         usernameVariable: 'U', passwordVariable: 'P')]) {
          sh '''
            echo "$P" | docker login -u "$U" --password-stdin
            docker push $IMAGE:$TAG
            docker push $IMAGE:latest
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'ec2-ssh-key', keyFileVariable: 'KEY')]) {
          sh '''
            cd ansible
            printf "[k8s]\\n$APP_IP ansible_user=ubuntu ansible_ssh_private_key_file=$KEY ansible_ssh_common_args='-o StrictHostKeyChecking=no'\\n" > jenkins_inventory.ini
            APP_IMAGE=$IMAGE:$TAG ansible-playbook -i jenkins_inventory.ini k8s.yml
          '''
        }
      }
    }

    stage('OWASP ZAP Baseline') {
      steps {
        catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
          sh '''
            mkdir -p reports
            docker run --rm --user root --volumes-from jenkins --entrypoint sh \
              ghcr.io/zaproxy/zaproxy:stable -c \
              "mkdir -p /zap/wrk && ln -sfn $WORKSPACE/reports /zap/wrk/reports && \
               /zap/zap-baseline.py -t http://$APP_IP:30500 -r reports/zap-report.html -I"
          '''
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
      sh 'docker logout || true'
    }
  }
}
