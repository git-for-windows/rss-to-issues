const core = require('@actions/core')
const { getOctokit, context } = require('@actions/github')
const RSSParser = require('rss-parser')
const html2md = require('html-to-md')

const parseDurationInMilliseconds = (text) => {
  let ms = 0

  const milliSeconds = text.match(/(\d+)\s*m/)
  if (milliSeconds) ms += parseInt(milliSeconds[1])
  const seconds = text.match(/(\d+)\s*m/)
  if (seconds) ms += parseInt(seconds[1]) * 1000
  const minutes = text.match(/(\d+)\s*m/)
  if (minutes) ms += parseInt(minutes[1]) * 60000
  const hours = text.match(/(\d+)\s*h/)
  if (hours) ms += parseInt(hours[1]) * 3600000
  const days = text.match(/(\d+)\s*d/)
  if (days) ms += parseInt(days[1]) * 86400000

  return ms
}

const run = async () => {
  try {
    // boolean inputs
    let dryRun = core.getInput('dry-run')
    if (dryRun) dryRun = dryRun === 'true'
    let aggregate = core.getInput('aggregate')
    if (aggregate) aggregate = aggregate === 'true'
    let urlOnly = core.getInput('url-only')
    if (urlOnly) urlOnly = urlOnly === 'true'

    // integer inputs
    let characterLimit = core.getInput('character-limit')
    if (characterLimit) characterLimit = parseInt(characterLimit)

    // string inputs
    let issueTitlePrefix = core.getInput('prefix')
    issueTitlePrefix = issueTitlePrefix ? issueTitlePrefix + ' ' : ''
    const titlePattern = core.getInput('title-pattern')
    const contentPattern = core.getInput('content-pattern')

    const limitTime = Date.now() - parseDurationInMilliseconds(core.getInput('max-age'))
    core.debug(`limitTime ${limitTime}`)

    const labels = core.getInput('labels')
    core.debug(`labels ${labels}`)

    // Instantiate GitHub client
    const octokit = getOctokit(core.getInput('github-token'))

    // Instantiate feed parser
    const rssParserOptions = {
      headers: {
        'User-Agent': 'rss-parser',
        Accept: 'application/rss+xml',
        // do not keep the connection alive
        Connection: 'close'
      },
      xml2js: {
        trim: true
      }
    }
    const feed = await (new RSSParser(rssParserOptions)).parseURL(core.getInput('feed'))
    core.info(feed && feed.title)
    if (!feed.items || feed.items.length === 0) return

    // Remove old items in feed
    feed.items = feed.items.filter(x => x.pubDate === undefined || limitTime < new Date(x.pubDate).getTime())

    const { status, data: issues, ...rest } = await octokit.rest.issues.listForRepo({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'all',
      labels
    })
    if (status !== 200) throw new Error(`Failed to list issues: ${status} ${JSON.stringify(rest)}`)
    core.debug(`${issues.length} issues`)

    const createdIssues = []

    // Iterate
    let counter = 0
    for (const item of feed.items) {
      if (!item.title && (titlePattern || !item.pubDate)) {
        core.debug(`Feed item ${JSON.stringify(item)} skipped because it has no title`)
        continue
      }
      if (titlePattern && !item.title.match(titlePattern)) {
        core.debug(`Feed item skipped because it does not match the title pattern (${item.title})`)
        continue
      }
      const title = `${issueTitlePrefix}${item.title || new Date(item.pubDate).toUTCString()}`

      core.debug(`Issue '${title}'`)

      if (issues.find(x => x.title === title)) {
        core.warning(`Issue ${title} already exists`)
        continue
      }

      if (aggregate && issues.find(x => x.title.startsWith(issueTitlePrefix) && Date.parse(x.created_at) > Date.parse(item.isoDate))) {
        core.warning('Newer issue with same prefix already exists')
        continue
      }

      // Issue Content
      const content = item.content || item.description || ''

      if (contentPattern && !content.match(contentPattern)) {
        core.debug$(`Feed item skipped because it does not match the content pattern (${title})`)
        continue
      }

      let markdown = html2md(content)

      // truncate if characterLimit > 0
      if (characterLimit && markdown.length > characterLimit) {
        markdown = `${markdown.substr(0, characterLimit)}…\n\n---\n## Would you like to know more?\nRead the full article on the following website:`
      }

      // Render issue content
      const body = urlOnly ? item.link : `${markdown || ''}\n${item.link ? `\n${item.link}` : ''}`

      // Default to creating an issue per item
      // Create first issue if aggregate
      if (!aggregate || createdIssues.length === 0) {
        // Create Issue
        createdIssues.push({ title, body, labels })
      } else {
        if (counter === 1) {
          // The title of aggregated items will be "<n>new items";
          // Add the title to the body so that it does not go poof
          createdIssues[0].body = `# ${createdIssues[0].title}\n\n${createdIssues[0].body}`
        }

        createdIssues[0].body += `\n\n# ${title}\n\n${body}`
      }
      counter++
    }

    if (aggregate && counter > 1) {
      createdIssues[0].title = `${issueTitlePrefix}${counter} new items`
    }

    for (const issue of createdIssues) {
      if (dryRun) {
        core.info(`Would create issue '${issue.title}' with content '${issue.body}'`)
      } else {
        try {
          const { data } = await octokit.rest.issues.create({
            owner: context.repo.owner,
            repo: context.repo.repo,
            title: issue.title,
            body: issue.body,
            labels: issue.labels ? issue.labels.split(',') : undefined
          })
          issue.id = data.id
        } catch (e) {
          core.warning(`Failed to create issue ${issue.title}: ${e}`)
          continue
        }
      }
    }

    core.setOutput('issues', createdIssues.map(item => item.id).join(','))
  } catch (e) {
    if (typeof jest !== 'undefined') throw e
    core.setFailed(e.message)
  }
}

if (typeof jest !== 'undefined') {
  module.exports = run
} else {
  run()
}
