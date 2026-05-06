import RSSParser from 'rss-parser'

import run from '..'

const xml2jsTrim = { xml2js: { trim: true } }
const parseXml = (xml) => new RSSParser(xml2jsTrim).parseString(xml)

const inputs = {}

const makeDeps = () => {
  const issuesAPI = {
    create: vi.fn(),
    listForRepo: vi.fn()
  }
  const octokit = { paginate: vi.fn(), rest: { issues: issuesAPI } }
  return {
    core: {
      getInput: (key) => inputs[key],
      setOutput: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warning: vi.fn()
    },
    getOctokit: vi.fn(() => octokit),
    context: { repo: { owner: 'owner', repo: 'repo' } },
    parseFeed: vi.fn(),
    octokit,
    issuesAPI
  }
}

let deps
beforeEach(() => {
  for (const key of Object.keys(inputs)) delete inputs[key]
  Object.assign(inputs, {
    feed: 'https://test.feed',
    'max-age': '48h',
    'github-token': 'TOKEN'
  })
  deps = makeDeps()
})

test('handles feeds without any entries', async () => {
  deps.parseFeed.mockResolvedValueOnce(await parseXml('<feed xmlns="http://www.w3.org/2005/Atom" />'))
  await run(deps)

  expect(deps.parseFeed).toHaveBeenCalledTimes(1)
  expect(deps.octokit.paginate).not.toHaveBeenCalled()
  expect(deps.issuesAPI.create).not.toHaveBeenCalled()
})

test('handles feed entries without titles', async () => {
  const date = '2021-06-19T01:01:29+12:00'
  deps.parseFeed.mockResolvedValueOnce(await parseXml(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><published>${date}</published><content type="html">TBD</content></entry></feed>`))
  inputs['max-age'] = '9999d'
  deps.octokit.paginate.mockResolvedValueOnce([])
  await run(deps)

  expect(deps.parseFeed).toHaveBeenCalledTimes(1)
  expect(deps.octokit.paginate).toHaveBeenCalledTimes(1)
  expect(deps.issuesAPI.create).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    title: new Date(date).toUTCString(),
    body: 'TBD\n'
  })
})

test('html to markdown conversion', async () => {
  const date = new Date().toISOString()
  deps.parseFeed.mockResolvedValueOnce(await parseXml(`<?xml version="1.0" encoding="UTF-8"?>
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
`))
  deps.octokit.paginate.mockResolvedValueOnce([])
  await run(deps)

  expect(deps.issuesAPI.create).toHaveBeenCalledWith({
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
  deps.parseFeed.mockResolvedValueOnce(await parseXml(`<?xml version="1.0" encoding="UTF-8"?>
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
</feed>`))
  deps.octokit.paginate.mockResolvedValueOnce([])
  Object.assign(inputs, {
    'max-age': '9999d',
    prefix: '[New curl version]',
    'title-pattern': '^(?!rc-)'
  })
  await run(deps)

  expect(deps.parseFeed).toHaveBeenCalledTimes(1)
  expect(deps.octokit.paginate).toHaveBeenCalledTimes(1)
  expect(deps.issuesAPI.create).toHaveBeenCalledTimes(1)
  expect(deps.issuesAPI.create).toHaveBeenCalledWith({
    owner: 'owner',
    repo: 'repo',
    title: '[New curl version] 8.14.1',
    body: '\n\nhttps://github.com/curl/curl/releases/tag/curl-8_14_1',
    labels: undefined
  })
})

test('errors out if GitHub API returns 500', async () => {
  deps.parseFeed.mockResolvedValueOnce(await parseXml(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="en-US">
  <entry>
    <title>Hello></title>
    <published>${new Date().toUTCString()}</published>
    <content type="html">TBD</content>
  </entry>
</feed>`))
  deps.octokit.paginate.mockRejectedValueOnce(new Error('500 Server Error'))
  await expect(run(deps)).rejects.toThrow('Failed to list issues: 500 Server Error')
  expect(deps.octokit.paginate).toHaveBeenCalledTimes(1)
})

test('rejects an invalid title-pattern with a clear error', async () => {
  inputs['title-pattern'] = '['
  await expect(run(deps)).rejects.toThrow("Invalid 'title-pattern':")
  expect(deps.parseFeed).not.toHaveBeenCalled()
})

test('rejects an empty max-age with a clear error', async () => {
  inputs['max-age'] = ''
  await expect(run(deps)).rejects.toThrow("Invalid 'max-age': ''")
  expect(deps.parseFeed).not.toHaveBeenCalled()
})

test('emits issue numbers (not database IDs) on the `issues` output', async () => {
  const date = new Date().toISOString()
  deps.parseFeed.mockResolvedValueOnce(await parseXml(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>x</title><published>${date}</published><content type="html">y</content></entry></feed>`))
  deps.octokit.paginate.mockResolvedValueOnce([])
  deps.issuesAPI.create.mockResolvedValueOnce({ data: { id: 9876543210, number: 42 } })

  await run(deps)

  expect(deps.core.setOutput).toHaveBeenCalledWith('issues', '42')
})

test('aggregate dedup fires for items without isoDate when a newer issue exists', async () => {
  Object.assign(inputs, { aggregate: 'true', prefix: '[New]' })
  // Feed entry with no <published> or <updated>, so item.isoDate is undefined.
  deps.parseFeed.mockResolvedValueOnce(await parseXml(
    '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>x</title><content type="html">y</content></entry></feed>'
  ))
  deps.octokit.paginate.mockResolvedValueOnce([
    { title: '[New] 5 new items', created_at: new Date().toISOString() }
  ])

  await run(deps)

  expect(deps.issuesAPI.create).not.toHaveBeenCalled()
  expect(deps.core.warning).toHaveBeenCalledWith('Newer issue with same prefix already exists')
})

test('skips url-only items that have no link', async () => {
  const date = new Date().toISOString()
  inputs['url-only'] = 'true'
  // Entry with no <link> element.
  deps.parseFeed.mockResolvedValueOnce(await parseXml(
    `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>x</title><published>${date}</published><content type="html">y</content></entry></feed>`
  ))
  deps.octokit.paginate.mockResolvedValueOnce([])

  await run(deps)

  expect(deps.issuesAPI.create).not.toHaveBeenCalled()
  expect(deps.core.warning).toHaveBeenCalledWith(expect.stringContaining('url-only is true but the item has no link'))
})
