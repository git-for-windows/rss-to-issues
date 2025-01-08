# RSS to Issues GitHub Action

This GitHub Action creates issues from an RSS or Atom feed.

New issues will only be created if no issue exists that corresponds to the feed item. Optionally, the issues' titles can be prefixed, and labeled. There are multiple ways to restrict what feed items this Action acts on.

This GitHub Action is a Javascript port of the [rss-issues Action](https://github.com/guilhem/rss-issues-action). See [below](#Compatibility) for more details.

## Inputs

### `github-token`

**Required** the `GITHUB_TOKEN` secret.

### `feed`

**Required** URL of the RSS/Atom feed.

### `prefix`

Prefix added to the created issues' titles.

### `max-age`

If specified, only look at feed items younger than the specified age. For example, `48h` will only look at feed items from the last forty-eight hours.

Note: This Action is typically run in a scheduled workflow, and the age should be adjusted in accordance with that schedule. That is, if the workflow is run once per day, `max-age` should be set to at least 24h (probably a bit more in case GitHub Actions experiences problems).

### `labels`

Labels to add, comma separated.

### `dry-run`

Log issue creation but do nothing

### `aggregate`

Aggregate all items in a single issue

Note: If you use this Action to create issues from multiple aggregated feeds in the same repository, give them different prefixes and/or labels.

### `character-limit`

Limit the issue contents' size

### `title-pattern`

Only create an issue if the title matches the specified [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).

To _exclude_ titles based on a pattern, you can use a negative lookahead. For example, to filter out all feed items whose title contains "TEST", use a regular expression like `/^(?!.*TEST)/`.

### `content-pattern`

Only create an issue if the content matches the specified [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).

To _exclude_ items based on their content, you can use a negative lookahead. For example, to filter out all feed items whose text contains "TEST", use a regular expression like `/^(?!.*TEST)/`.

### `url-only`

If set, only the URL is added to the issue body

## Outputs

### `issues`

Issue IDs, comma separated.

## Example

### step

```yaml
uses: git-for-windows/rss-to-issues
with:
  github-token: ${{ secrets.GITHUB_TOKEN }}
  feed: "https://cloud.google.com/feeds/kubernetes-engine-release-notes.xml"
```

### complete

```yaml
name: Monitor new Git versions

on:
  schedule:
    # Run this Action every day at 7:37am UTC
    - cron: "37 7 * * *"

jobs:
  gke-release:
    runs-on: ubuntu-latest
    steps:
      - uses: git-for-windows/rss-to-issues@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          feed: https://github.com/git/git/tags.atom
          prefix: "[Git]"
          character-limit: 255
          dry-run: false
          max-age: 48h
          labels: git
          url-only: false
```

### Real Usage

- [Git for Windows' component updates](https://github.com/git-for-windows/git/issues?q=label%3Acomponent-update)

## Compatibility

This GitHub Action is a Javascript port of the Go version at [`guilhem/rss-issues-action`](https://github.com/guilhem/rss-issues-action). The port exists because the Go version has to run in a Docker image, and therefore it is slower to load than the Javascript Action, it has to be pre-compiled, and it has to be uploaded to a Docker registry (i.e. it is subject to network issues when there is a problem connecting from GitHub Actions' build agents).

This Action uses different input names than `rss-issues-action` (e.g. `github-token` instead of `repo-token`). This is the full list of the mappings:

- `repo-token` was renamed to `github-token`
- `lastTime` was renamed to `max-age`
- `characterLimit` was renamed to `character-limit`
- `titleFilter` corresponds to `title-pattern` and is no longer _exclusive_ but _inclusive_ (read: only feed items matching the `title-pattern` are processed, as opposed to excluding feed items matching the `titleFilter` pattern)
- `contentFilter` corresponds to `content-pattern` and is no longer _exclusive_ but _inclusive_ (read: only feed items matching the `content-pattern` are processed, as opposed to excluding feed items matching the `contentFilter` pattern)

Another big difference is that this Action understands Javascript regular expressions, i.e. it supports lookaheads and friends, something that Go's `RE2` does not support.

While at it, the Javascript version fixes the bug where `rss-issues-action` did not set the output as documented.
