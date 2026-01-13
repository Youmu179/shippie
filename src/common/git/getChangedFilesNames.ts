import { exec } from 'node:child_process'
import { join } from 'node:path'

import {
  getGitHubEnvVariables,
  getGitLabEnvVariables,
  gitAzdevEnvVariables,
} from '../../config'
import { PlatformOptions } from '../types'
import { logger } from '../utils/logger'

export const getDiffCommand = (isCi: string | undefined): string => {
  const diffOptions = '--diff-filter=AMRT -U0'

  if (isCi === PlatformOptions.GITHUB) {
    const { githubSha, baseSha } = getGitHubEnvVariables()
    return `git diff ${diffOptions} ${baseSha} ${githubSha}`
  }

  if (isCi === PlatformOptions.GITLAB) {
    const { gitlabSha, mergeRequestBaseSha } = getGitLabEnvVariables()
    return `git diff ${diffOptions} ${mergeRequestBaseSha} ${gitlabSha}`
  }

  if (isCi === PlatformOptions.AZDEV) {
    const { azdevSha, baseSha } = gitAzdevEnvVariables()
    return `git diff ${diffOptions} ${baseSha} ${azdevSha}`
  }

  if (isCi === PlatformOptions.LOCAL) {
    // 支持通过环境变量使用两次提交的比较（用于两次提交的更改模式）
    // 如果设置了 SHIPPIE_USE_LAST_COMMIT=true，使用两次提交的差异
    const useTwoCommits = process.env.SHIPPIE_USE_LAST_COMMIT === 'true'
    
    if (useTwoCommits) {
      // 获取两个提交的引用
      // baseSha 是较旧的版本（HEAD2），currentSha 是较新的版本（HEAD1）
      // 如果值为空字符串，表示工作区，需要特殊处理
      let baseSha = process.env.SHIPPIE_BASE_SHA
      let currentSha = process.env.SHIPPIE_CURRENT_SHA
      
      // 如果值为空字符串，表示工作区，不传入该参数
      // 如果两个值都为空或未设置，使用默认值 HEAD~1 和 HEAD
      if ((!baseSha || baseSha === '') && (!currentSha || currentSha === '')) {
        logger.debug(
          `Using default commit diff for local platform: HEAD~1..HEAD`
        )
        return `git diff ${diffOptions} HEAD~1 HEAD`
      }
      
      // 构建 git diff 命令
      // git diff <older> <newer> 表示比较 older 和 newer 之间的差异
      // 如果 baseSha 为空，只传入 currentSha（比较 currentSha 和工作区）
      // 如果 currentSha 为空，只传入 baseSha（比较 baseSha 和工作区）
      // 如果两个都不为空，传入两个参数
      let diffCommand = `git diff ${diffOptions}`
      
      if (baseSha && baseSha !== '') {
        diffCommand += ` ${baseSha}`
      }
      
      if (currentSha && currentSha !== '') {
        diffCommand += ` ${currentSha}`
      }
      
      logger.debug(
        `Using two commits diff for local platform: ${baseSha || '(working)'}..${currentSha || '(working)'}`
      )
      return diffCommand
    }
    
    // 默认行为：查看暂存区（用于暂存区模式）
    return `git diff ${diffOptions} --cached`
  }

  throw new Error('Invalid CI platform')
}

export const getGitRoot = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec('git rev-parse --show-toplevel', (error, stdout) => {
      if (error) {
        reject(new Error(`Failed to find git root. Error: ${error.message}`))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

export const getChangedFilesNames = async (
  isCi: string | undefined
): Promise<string[]> => {
  const gitRoot = await getGitRoot()
  logger.debug('gitRoot', gitRoot)
  const nameOnlyCommand = getDiffCommand(isCi).replace('-U0', '--name-only')
  logger.debug('nameOnlyCommand', nameOnlyCommand)
  return new Promise((resolve, reject) => {
    exec(nameOnlyCommand, { cwd: gitRoot }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to execute command. Error: ${error.message}`))
      } else if (stderr) {
        reject(new Error(`Command execution error: ${stderr}`))
      } else {
        const files = stdout
          .split('\n')
          .filter((fileName) => fileName.trim() !== '')
          .map((fileName) => join(gitRoot, fileName.trim()))
        resolve(files)
      }
    })
  })
}
