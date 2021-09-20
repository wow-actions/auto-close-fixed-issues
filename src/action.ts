import * as core from '@actions/core'
import * as github from '@actions/github'
import mustache from 'mustache'

export async function run() {
  try {
    const { context } = github

    core.debug(`event: ${context.eventName}`)
    core.debug(`action: ${context.payload.action}`)

    if (
      context.eventName !== 'pull_request' &&
      context.eventName !== 'pull_request_target'
    ) {
      core.info(
        'This action is supposed to run for pushes to pull requests only. Stepping out...',
      )
      return
    }

    if (context.payload.action !== 'closed') {
      core.info(
        'This action is supposed to run for closed pull requests only. Stepping out...',
      )
      return
    }

    const pr = context.payload.pull_request
    if (!pr) {
      return
    }

    if (!pr.merged) {
      core.info('Pull request is not merged. Stepping out...')
      return
    }

    const token = core.getInput('GITHUB_TOKEN', { required: true })
    const octokit = github.getOctokit(token)

    const repoResponse = await octokit.rest.repos.get({
      ...context.repo,
    })

    if (repoResponse.data.default_branch === pr.base.ref) {
      core.info(
        `Base branch (${repoResponse.data.default_branch}) is the default branch of this repository. GitHub will already do what we want.`,
      )

      const ignore = core.getInput('ignore') !== 'false'
      if (ignore) {
        return
      }
    }

    const issues: string[] = []
    const collect = (body: string) => {
      // @see: https://regex101.com/r/5Zet3S/1
      const regex = /(?:(?:resolv|clos|fix)e[ds]?|fix) +#(\d+)/gi
      let match = regex.exec(body)
      while (match) {
        if (!issues.includes(match[1])) {
          issues.push(match[1])
          core.info(`Found fixed issue: #${match[1]}.`)
        }
        match = regex.exec(body)
      }
    }

    if (pr.body) {
      collect(pr.body)
    }

    const { data: commits } = await octokit.rest.pulls.listCommits({
      ...context.repo,
      pull_number: pr.number,
    })

    commits.forEach(({ commit }) => {
      collect(commit.message)
    })

    if (issues.length === 0) {
      core.info(`This pull request fixes no issue. Stepping out...`)
      return
    }

    const comment = core.getInput('comment')

    // eslint-disable-next-line no-restricted-syntax
    for (const id of issues) {
      const issue_number = parseInt(id, 10) // eslint-disable-line camelcase
      // eslint-disable-next-line no-await-in-loop
      const issueResponse = await octokit.rest.issues.get({
        ...context.repo,
        issue_number,
      })

      if (issueResponse.data.state !== 'closed') {
        // eslint-disable-next-line no-await-in-loop
        await octokit.rest.issues.update({
          ...context.repo,
          issue_number,
          state: 'closed',
        })
      }

      if (comment) {
        core.info(`Commenting on #${id}...`)
        // eslint-disable-next-line no-await-in-loop
        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number,
          body: mustache.render(comment, { pr: pr.number }),
        })
      }
    }
  } catch (e) {
    core.setFailed(e)
  }
}
