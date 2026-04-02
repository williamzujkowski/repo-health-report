# Analyze a GitHub repo with AI expert grading

Run a comprehensive health analysis of a GitHub repository using static analysis + nexus-agents AI expert consensus voting.

## Steps

1. **Static Analysis**: Run `node dist/cli.js $ARGUMENTS --json` to get structured health findings
2. **Deep Analysis**: Call `mcp__nexus-agents__repo_analyze` with the repo for language/framework/security detection
3. **Security Plan**: Call `mcp__nexus-agents__repo_security_plan` for scanning gap analysis
4. **Consensus Vote**: Call `mcp__nexus-agents__consensus_vote` with a proposal summarizing static + deep findings, asking agents to grade the repo health and provide recommendations
5. **Render**: Present a combined report with:
   - Static dimension scores (Security, Testing, Docs, Architecture, DevOps)
   - nexus-agents deep analysis (language, framework, gaps)
   - Security coverage map
   - Consensus grade with expert reasoning
   - Prioritized recommendations

## Usage

```
/analyze owner/repo
```

## Notes

- Static analysis runs first (always works, no API keys needed)
- AI analysis requires nexus-agents MCP server to be configured
- Consensus vote uses higher_order strategy for architecture/security assessment
- The vote proposal includes project type context (application vs IaC vs library) to avoid unfair penalization
