#! /bin/bash
APP_NAME="k8s-graph"
VERSION="latest"
DOCKER_REGISTRY="artifact-docker-infra.meetic.ilius.net/artifactory/docker-infra"
TAG_IMAGE="${DOCKER_REGISTRY}/${APP_NAME}"
FINAL_TAG_IMAGE="${TAG_IMAGE}:${VERSION}"
docker build --platform=linux/amd64 --no-cache-filter COPY -t ${FINAL_TAG_IMAGE} .
docker push ${FINAL_TAG_IMAGE}
