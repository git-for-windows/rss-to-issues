const { expect, test } = require('@jest/globals')
const https = require('https')

jest.mock('@actions/core')
jest.mock('@actions/github')

const core = require('@actions/core')
const { getOctokit, context } = require('@actions/github')

const run = require('..')

core.getInput = (key) => core.__INPUTS__[key]
core.__INPUTS__ = {
  feed: 'https://test.feed',
  'max-age': '48h',
  'github-token': 'TOKEN'
}

const mockHTTPSGet = {
  write: jest.fn(),
  on: jest.fn().mockImplementation((event, cb) => {
    if (event === 'end') {
      cb()
    } else if (event === 'data') {
      cb(mockHTTPSGet.__RETURN__)
    }
  }),
  end: jest.fn(),
  setEncoding: jest.fn(),
  headers: {
    'content-length': 0
  }
}
https.get = jest.fn().mockImplementation((url, callback) => {
  mockHTTPSGet.headers['content-length'] = mockHTTPSGet.__RETURN__.length
  callback(mockHTTPSGet)
  return mockHTTPSGet
})

const octokit = {
  rest: {
    issues: {
      create: jest.fn(),
      listForRepo: jest.fn()
    }
  }
}
getOctokit.mockImplementation(() => octokit)
context.repo = { owner: 'owner', repo: 'repo' }

test('handles feeds without any entries', async () => {
  mockHTTPSGet.__RETURN__ = '<feed xmlns="http://www.w3.org/2005/Atom" />'
  await run()

  expect(https.get).toHaveBeenCalledTimes(1)
  expect(octokit.rest.issues.listForRepo).not.toHaveBeenCalled()
  expect(octokit.rest.issues.create).not.toHaveBeenCalled()
})

test('handles feed entries without titles', async () => {
  const date = '2021-06-19T01:01:29+12:00'
  mockHTTPSGet.__RETURN__ = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><published>${date}</published><content type="html">TBD</content></entry></feed>`
  core.__INPUTS__['max-age'] = '9999d'
  octokit.rest.issues.listForRepo.mockReturnValueOnce({ data: [] })
  await run()

  expect(https.get).toHaveBeenCalledTimes(1)
  expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(1)
  expect(octokit.rest.issues.create).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    title: new Date(date).toUTCString(),
    body: 'TBD\n'
  })
})

test('html to markdown conversion', async () => {
  const date = new Date().toISOString()
  mockHTTPSGet.__RETURN__ = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="en-US">
  <id>tag:github.com,2008:/git-for-windows/rss-to-issues/commits/main</id>
  <link type="text/html" rel="alternate" href="https://github.com/git-for-windows/rss-to-issues/commits/main"/>
  <link type="application/atom+xml" rel="self" href="https://github.com/git-for-windows/rss-to-issues/commits/main.atom"/>
  <title>Recent Commits to rss-to-issues:main</title>
  <updated>${date}</updated>
  <entry>
    <id>tag:github.com,2008:Grit::Commit/394ee852b18c5e3bca536b585cbb95d32ce77057</id>
    <link type="text/html" rel="alternate" href="https://github.com/git-for-windows/rss-to-issues/commit/394ee852b18c5e3bca536b585cbb95d32ce77057"/>
    <title>
        ci(release-tags): use newer versions of Actions
    </title>
    <updated>${date}</updated>
    <media:thumbnail height="30" width="30" url="https://avatars.githubusercontent.com/u/127790?s=30&amp;v=4"/>
    <author>
      <name>dscho</name>
      <uri>https://github.com/dscho</uri>
    </author>
    <content type="html">
      &lt;pre style=&#39;white-space:pre-wrap;width:81ex&#39;&gt;ci(release-tags): use newer versions of Actions

This avoids warnings about node.js/set-output deprecations.

Signed-off-by: Johannes Schindelin &amp;lt;johannes.schindelin@gmx.de&amp;gt;&lt;/pre&gt;
    </content>
  </entry>
</feed>
`
  octokit.rest.issues.listForRepo.mockReturnValueOnce({ data: [] })
  await run()

  expect(octokit.rest.issues.create).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    title: 'ci(release-tags): use newer versions of Actions',
    body: `\`\`\`
ci(release-tags): use newer versions of Actions

This avoids warnings about node.js/set-output deprecations.

Signed-off-by: Johannes Schindelin <johannes.schindelin@gmx.de>
\`\`\`

https://github.com/git-for-windows/rss-to-issues/commit/394ee852b18c5e3bca536b585cbb95d32ce77057`
  })
})

test('curl -rc versions', async () => {
  mockHTTPSGet.__RETURN__ = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="en-US">
  <id>tag:github.com,2008:https://github.com/curl/curl/releases</id>
  <link type="text/html" rel="alternate" href="https://github.com/curl/curl/releases"/>
  <link type="application/atom+xml" rel="self" href="https://github.com/curl/curl/releases.atom"/>
  <title>Tags from curl</title>
  <updated>2025-06-30T11:34:35Z</updated>
  <entry>
    <id>tag:github.com,2008:Repository/569041/rc-8_15_0-2</id>
    <updated>2025-06-30T11:34:35Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/curl/curl/releases/tag/rc-8_15_0-2"/>
    <title>rc-8_15_0-2</title>
    <content></content>
    <author>
      <name>bagder</name>
    </author>
    <media:thumbnail height="30" width="30" url="https://avatars.githubusercontent.com/u/177011?s=60&amp;v=4"/>
  </entry>
  <entry>
    <id>tag:github.com,2008:Repository/569041/rc-8_15_0-1</id>
    <updated>2025-06-21T09:50:00Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/curl/curl/releases/tag/rc-8_15_0-1"/>
    <title>rc-8_15_0-1</title>
    <content></content>
    <author>
      <name>bagder</name>
    </author>
    <media:thumbnail height="30" width="30" url="https://avatars.githubusercontent.com/u/177011?s=60&amp;v=4"/>
  </entry>
  <entry>
    <id>tag:github.com,2008:Repository/569041/curl-8_14_1</id>
    <updated>2025-06-04T05:59:07Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/curl/curl/releases/tag/curl-8_14_1"/>
    <title>8.14.1</title>
    <content></content>
    <author>
      <name>bagder</name>
    </author>
    <media:thumbnail height="30" width="30" url="https://avatars.githubusercontent.com/u/177011?s=60&amp;v=4"/>
  </entry>
</feed>`
  octokit.rest.issues.listForRepo.mockReturnValueOnce({ data: [] })
  Object.assign(core.__INPUTS__, {
    'max-age': '9999d',
    prefix: '[New curl version]',
    'title-pattern': '^(?!rc-)'
  })
  await run()

  expect(https.get).toHaveBeenCalledTimes(1)
  expect(octokit.rest.issues.listForRepo).toHaveBeenCalledTimes(1)
  expect(octokit.rest.issues.create).toHaveBeenCalledTimes(1)
  expect(octokit.rest.issues.create).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    title: '[New curl version] 8.14.1',
    body: '\n\nhttps://github.com/curl/curl/releases/tag/curl-8_14_1',
    labels: undefined
  })
})
