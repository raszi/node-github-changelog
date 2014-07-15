# GitHub Conventional Changelog

## About

This small application can create a markdown changelog from GitHub [conventional-changelog][1] formatted pull-requests.

## How to install

```bash
npm install -g github-conventional-changelog
```

## Usage

```bash
github-conventional-changelog -s -t RepoName -o <oauth_key> <user>/<repo> > CHANGELOG.md
```

This will create a new changelog based on your pull-request from the <user>/<repo>.
 
[1]: https://github.com/ajoslin/conventional-changelog/blob/master/CONVENTIONS.md
