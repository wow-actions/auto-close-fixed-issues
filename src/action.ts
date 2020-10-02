import * as core from '@actions/core'
import * as github from '@actions/github'
import mustache from 'mustache'

export namespace Action {
  export async function run() {
    try {
      const context = github.context

      if (context.eventName !== 'pull_request') {
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

      const repoResponse = await octokit.repos.get({
        ...context.repo,
      })

      if (repoResponse.data.default_branch === pr.base.ref) {
        core.info(
          `Base branch (${repoResponse.data.default_branch}) is the default branch of this repository. GitHub will already do what we want.`,
        )
      }

      const body = pr.body
      const issues: string[] = []

      if (body) {
        const re = /(?:(?:resolv|clos|fix)e[ds]?|fix) +#(\d+)/gi // https://regex101.com/r/5Zet3S/1
        let match = re.exec(body)
        while (match) {
          issues.push(match[1])
          core.info(`Found fixed issue: #${match[1]}.`)
          match = re.exec(body)
        }
      }

      if (issues.length === 0) {
        core.info(`This pull request fixes no issue. Stepping out...`)
        return
      }

      const comment = core.getInput('comment')

      for (const id of issues) {
        const issue_number = parseInt(id, 10) // tslint:disable-line
        const issueResponse = await octokit.issues.get({
          ...context.repo,
          issue_number,
        })

        if (issueResponse.data.state !== 'closed') {
          await octokit.issues.update({
            ...context.repo,
            issue_number,
            state: 'closed',
          })
        }

        if (comment) {
          core.info(`Commenting on #${id}...`)
          await octokit.issues.createComment({
            ...context.repo,
            issue_number,
            body: mustache.render(comment, { pr: pr.number }),
          })
        }
      }
    } catch (e) {
      core.error(e)
      core.setFailed(e.message)
    }
  }
}
