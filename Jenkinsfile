pipeline {
  agent any

  options {
    buildDiscarder(logRotator(daysToKeepStr: '30', numToKeepStr: '50'))
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
  }

  parameters {
    string(name: 'NEW_VERSION', description: 'Optional semver tag (e.g. 1.0.1) to push on main/master', trim: true)
    string(name: 'RELEASE_NOTES', description: 'Optional release notes', trim: true)
  }

  environment {
    // ----- Edit these to your setup -----
    AWS_REGION     = 'eu-west-1'    
    ECR_REGISTRY   = '618717458389.dkr.ecr.eu-west-1.amazonaws.com'
    APP_NAME       = 'frank-cms'
    // ------------------------------------

    // Stash the computed tag so later steps (or deploy jobs) can read it
    DOCKER_TAG     = ''
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Export build properties (parity)') {
      steps {
        sh '''
          echo "NEW_VERSION=${NEW_VERSION}" > build.properties
          echo "RELEASE_NOTES=${RELEASE_NOTES}" >> build.properties
          cat build.properties
        '''
        archiveArtifacts artifacts: 'build.properties', onlyIfSuccessful: false
      }
    }

    stage('Build and Push Docker Image') {
      when {
        anyOf {
          branch 'develop'
          branch 'main'
        }
      }
      script {
            def gitCommit = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
            def branch = env.BRANCH_NAME
            // Tag will be in the format: develop-20210803120000-abc123
            def newTag = "${branch}-${new Date().format('yyyyMMddHHmmss')}-${gitCommit}"

            // Login to ECR
            sh """
              aws ecr get-login-password --region ${env.AWS_REGION} \
                | docker login --username AWS --password-stdin ${env.ECR_REGISTRY}
            """

            // Ensure repo exists (no-op if present)
            sh """
              aws ecr describe-repositories --repository-names ${env.APP_NAME} --region ${env.AWS_REGION} >/dev/null 2>&1 \
              || aws ecr create-repository --repository-name ${env.APP_NAME} --region ${env.AWS_REGION}
            """

            // Build + push branch-timestamp-commit tag
            sh """
              docker build \
                --build-arg SOURCE_VERSION=${gitCommit} \
                -t ${env.ECR_REGISTRY}/${env.APP_NAME}:${newTag} .
              docker push ${env.ECR_REGISTRY}/${env.APP_NAME}:${newTag}
            """
            env.DOCKER_TAG = newTag

            // Optionally also push a semver tag on main/master
            if ((branch == 'main') && params.NEW_VERSION?.trim()) {
              sh """
                docker tag  ${env.ECR_REGISTRY}/${env.APP_NAME}:${newTag} \
                            ${env.ECR_REGISTRY}/${env.APP_NAME}:${params.NEW_VERSION}
                docker push ${env.ECR_REGISTRY}/${env.APP_NAME}:${params.NEW_VERSION}
              """
            }
      }             
    }
  }

  post {
    always {
      sh 'docker image prune -f || true'
    }
  }
}