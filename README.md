[![GitHub release](https://img.shields.io/github/release/crazy-max/ghaction-container-scan.svg?style=flat-square)](https://github.com/crazy-max/ghaction-container-scan/releases/latest)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-container--scan-blue?logo=github&style=flat-square)](https://github.com/marketplace/actions/container-scan)
[![Test workflow](https://img.shields.io/github/workflow/status/crazy-max/ghaction-container-scan/test?label=test&logo=github&style=flat-square)](https://github.com/crazy-max/ghaction-container-scan/actions?workflow=test)
[![Codecov](https://img.shields.io/codecov/c/github/crazy-max/ghaction-container-scan?logo=codecov&style=flat-square)](https://codecov.io/gh/crazy-max/ghaction-container-scan)
[![Become a sponsor](https://img.shields.io/badge/sponsor-crazy--max-181717.svg?logo=github&style=flat-square)](https://github.com/sponsors/crazy-max)
[![Paypal Donate](https://img.shields.io/badge/donate-paypal-00457c.svg?logo=paypal&style=flat-square)](https://www.paypal.me/crazyws)

## About

GitHub Action to check for vulnerabilities in your container image with
[Trivy](https://github.com/aquasecurity/trivy).

![Screenshot](.github/scan-action.png)

___

* [Usage](#usage)
  * [Scan image](#scan-image)
  * [Scan tarball](#scan-tarball)
  * [Severity threshold](#severity-threshold)
  * [GitHub annotations](#github-annotations)
  * [Upload to GitHub Code Scanning](#upload-to-github-code-scanning)
  * [Build, scan and push your image](#build-scan-and-push-your-image)
* [Customizing](#customizing)
  * [inputs](#inputs)
  * [outputs](#outputs)
* [Contributing](#contributing)
* [License](#license)

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
          context: .
          push: true
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        uses: crazy-max/ghaction-container-scan@master
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
        name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v1
      -
        name: Build
        uses: docker/build-push-action@v2
        with:
          context: .
          outputs: type=oci,dest=/tmp/image.tar
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        uses: crazy-max/ghaction-container-scan@master
        with:
          tarball: /tmp/image.tar
```

### Severity threshold

You can define a threshold for severity to mark the job as failed:

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
          context: .
          push: true
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        uses: crazy-max/ghaction-container-scan@master
        with:
          image: user/app:latest
          severity_threshold: HIGH
```

![Severity threshold](.github/threshold.png)

### GitHub annotations

This action is also able to create GitHub annotations in your workflow for
vulnerabilities discovered:

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
          context: .
          push: true
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        uses: crazy-max/ghaction-container-scan@master
        with:
          image: user/app:latest
          annotations: true
```

![GitHub annotations](.github/annotations.png)

### Upload to GitHub Code Scanning

This action also supports the [SARIF format](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github)
for integration with [GitHub Code Scanning](https://docs.github.com/en/github/finding-security-vulnerabilities-and-errors-in-your-code/about-code-scanning)
to show issues in the [GitHub Security](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository)
tab:

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
          context: .
          push: true
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        id: scan
        uses: crazy-max/ghaction-container-scan@master
        with:
          image: user/app:latest
          dockerfile: ./Dockerfile
      -
        name: Upload SARIF file
        if: ${{ steps.scan.outputs.sarif != '' }}
        uses: github/codeql-action/upload-sarif@v1
        with:
          sarif_file: ${{ steps.scan.outputs.sarif }}
```

> :bulb: `dockerfile` input is required to generate a sarif report.

![GitHub Code Scanning](.github/codeql.png)

### Build, scan and push your image

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
        name: Set up QEMU
        uses: docker/setup-qemu-action@v1
      -
        name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v1
      -
        name: Build and load
        uses: docker/build-push-action@v2
        with:
          context: .
          load: true
          tags: user/app:latest
      -
        name: Scan for vulnerabilities
        id: scan
        uses: crazy-max/ghaction-container-scan@master
        with:
          image: user/app:latest
          dockerfile: ./Dockerfile
      -
        name: Build multi-platform and push
        uses: docker/build-push-action@v2
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: user/app:latest
```

## Customizing

### inputs

Following inputs can be used as `step.with` keys

| Name                   | Type     | Description                        |
|------------------------|----------|------------------------------------|
| `trivy_version`        | String   | [Trivy CLI](https://github.com/aquasecurity/trivy) version (default `latest`) |
| `image`                | String   | Container image to scan (e.g. `alpine:3.7`) |
| `tarball`              | String   | Container image tarball path to scan |
| `dockerfile`           | String   | Dockerfile required to generate a sarif report |
| `severity`             | String   | Report vulnerabilities of provided level or higher (default: `UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL`) |
| `severity_threshold`   | String   | Defines threshold for severity |
| `annotations`          | Bool     | Create GitHub annotations in your workflow for vulnerabilities discovered |

### outputs

Following outputs are available

| Name              | Type    | Description                           |
|-------------------|---------|---------------------------------------|
| `json`            | File    | JSON format scan result |
| `sarif`           | File    | SARIF format scan result |

## Contributing

Want to contribute? Awesome! The most basic way to show your support is to star the project, or to raise issues. If
you want to open a pull request, please read the [contributing guidelines](.github/CONTRIBUTING.md).

You can also support this project by [**becoming a sponsor on GitHub**](https://github.com/sponsors/crazy-max) or by
making a [Paypal donation](https://www.paypal.me/crazyws) to ensure this journey continues indefinitely!

Thanks again for your support, it is much appreciated! :pray:

## License

MIT. See `LICENSE` for more details.
