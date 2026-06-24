pipeline {
    agent any

    environment {
        AWS_REGION         = 'us-east-1'
        ECR_REGISTRY       = '679241558598.dkr.ecr.us-east-1.amazonaws.com'
        ECR_REPO           = 'nexus-app'
        IMAGE_TAG          = "${BUILD_NUMBER}"
        SONAR_PROJECT_KEY  = 'nexus-app'
        CONFIG_REPO        = 'git@github.com:ChaitanyaDaterao/nexus-config.git'
    }

    tools {
        nodejs 'NodeJS-20'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install --legacy-peer-deps'
            }
        }

        stage('Unit Tests') {
            steps {
                sh 'npm test -- --passWithNoTests --forceExit'
            }
            post {
                always {
                    junit '**/coverage/junit.xml'
                }
            }
        }

        stage('SAST - SonarQube') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh returnStatus: true, script: "${tool 'SonarScanner'}/bin/sonar-scanner -Dsonar.projectKey=${SONAR_PROJECT_KEY} -Dsonar.sources=src"
                }
            }
        }

        stage('Quality Gate') {
            steps {
                script {
                    try {
                        timeout(time: 2, unit: 'MINUTES') {
                            waitForQualityGate abortPipeline: false
                        }
                    } catch (err) {
                        echo "Quality Gate check failed: \${err.getMessage()} - continuing"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }

        stage('SCA - Dependency Check') {
            steps {
                dependencyCheck(
                    additionalArguments: '--scan ./ --format XML --out ./dependency-check-report',
                    odcInstallation: 'OWASP-DC'
                )
            }
            post {
                always {
                    dependencyCheckPublisher pattern: 'dependency-check-report/dependency-check-report.xml'
                }
            }
        }

        stage('Secret Scan - Gitleaks') {
            steps {
                sh '''
                    docker run --rm \
                      -v $(pwd):/path \
                      zricethezav/gitleaks:latest \
                      detect --source /path \
                      --config /path/.gitleaks.toml \
                      --exit-code 1
                '''
            }
        }

        stage('Docker Build') {
            steps {
                sh "docker build -t ${ECR_REGISTRY}/${ECR_REPO}:${IMAGE_TAG} ."
            }
        }

        stage('Image Scan - Trivy') {
            steps {
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v $(pwd):/tmp/trivy-cache \
                      aquasec/trivy:latest image \
                      --exit-code 1 \
                      --severity HIGH,CRITICAL \
                      --ignore-unfixed \
                      ${ECR_REGISTRY}/${ECR_REPO}:${IMAGE_TAG}
                '''
            }
        }

        stage('Push to ECR') {
            steps {
                withAWS(credentials: 'aws-credentials', region: "${AWS_REGION}") {
                    sh '''
                        aws ecr get-login-password --region ${AWS_REGION} | \
                        docker login --username AWS --password-stdin ${ECR_REGISTRY}
                        docker push ${ECR_REGISTRY}/${ECR_REPO}:${IMAGE_TAG}
                    '''
                }
            }
        }

        stage('Update Config Repo') {
            steps {
                withCredentials([sshUserPrivateKey(
                    credentialsId: 'github-token',
                    keyVariable: 'SSH_KEY'
                )]) {
                    sh '''
                        git config --global user.email "jenkins@nexus.com"
                        git config --global user.name "Jenkins CI"
                        git clone ${CONFIG_REPO} config-repo
                        cd config-repo
                        sed -i "s|tag:.*|tag: ${IMAGE_TAG}|g" charts/nexus-app/values/dev.yaml
                        git add .
                        git commit -m "ci: update image tag to ${IMAGE_TAG}"
                        git push origin main
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded - image ${ECR_REGISTRY}/${ECR_REPO}:${IMAGE_TAG} deployed to dev"
        }
        failure {
            echo "Pipeline failed at stage - check logs above"
        }
        always {
            cleanWs()
        }
    }
}
