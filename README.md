[![GitHub release](https://img.shields.io/github/release/crazy-max/docker-scan-action.svg?style=flat-square)](https://github.com/crazy-max/docker-scan-action/releases/latest)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-docker--scan-blue?logo=github&style=flat-square)](https://github.com/marketplace/actions/docker-scan)
[![CI workflow](https://img.shields.io/github/workflow/status/crazy-max/docker-scan-action/ci?label=ci&logo=github&style=flat-square)](https://github.com/crazy-max/docker-scan-action/actions?workflow=ci)
[![Test workflow](https://img.shields.io/github/workflow/status/crazy-max/docker-scan-action/test?label=test&logo=github&style=flat-square)](https://github.com/crazy-max/docker-scan-action/actions?workflow=test)
[![Codecov](https://img.shields.io/codecov/c/github/crazy-max/docker-scan-action?logo=codecov&style=flat-square)](https://codecov.io/gh/crazy-max/docker-scan-action)

## About

GitHub Action to check for vulnerabilities in your Docker image.

___

* [Usage](#usage)
  * [Scan image](#scan-image)
  * [Scan tarball](#scan-tarball)
* [Keep up-to-date with GitHub Dependabot](#keep-up-to-date-with-github-dependabot)

## Usage

### Scan image

```yaml
name: ci

on:
  push:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      -
        name: Checkout
        uses: actions/checkout@v2
      -
        name: Build
        uses: docker/build-push-action@v2
        with:
          push: true
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        uses: crazy-max/docker-scan-action@master
        with:
          image: user/app:latest
```

### Scan tarball

```yaml
name: ci

on:
  push:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      -
        name: Checkout
        uses: actions/checkout@v2
      -
        name: Build
        uses: docker/build-push-action@v2
        with:
          outputs: type=oci,dest=/tmp/image.tar
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        uses: crazy-max/docker-scan-action@master
        with:
          tarball: /tmp/image.tar
```

## Keep up-to-date with GitHub Dependabot

Since [Dependabot](https://docs.github.com/en/github/administering-a-repository/keeping-your-actions-up-to-date-with-github-dependabot)
has [native GitHub Actions support](https://docs.github.com/en/github/administering-a-repository/configuration-options-for-dependency-updates#package-ecosystem),
to enable it on your GitHub repo all you need to do is add the `.github/dependabot.yml` file:

```yaml
version: 2
updates:
  # Maintain dependencies for GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "daily"
```
