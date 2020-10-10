# Auto Close Issues

A Github Action to automatically close issues fixed in pull requests that doesn't target the default branch.

Comment keywords are documented [here](https://help.github.com/en/articles/closing-issues-using-keywords):

```
Fixes #1,#2,#3
close #1, #2, #3
fix #1 #2 #3
resolve #1,#2 #3
Resolves: #1,#2,#3
closed : #1, #2, #3
```

## Usage

Create a file named `.github/workflows/auto-close-fixed-issues`.

```yml
name: Auto Close Issues

on:
  pull_request:
    types: [closed]

jobs:
  close:
    runs-on: ubuntu-latest
    steps:
      - uses: bubkoo/auto-close-fixed-issues@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # optional comment
          # comment: This issue was closed by #{{ pr }}.
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).
