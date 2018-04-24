'use babel';

// eslint-disable-next-line import/no-extraneous-dependencies, import/extensions
import { CompositeDisposable } from 'atom';

let path;
let helpers;

const pattern = '.+:(?<line>\\d+): (?<message>.*)';

function loadDeps() {
  if (!helpers) {
    helpers = require('atom-linter');
  }
  if (!path) {
    path = require('path');
  }
}

function reportToMessage(report, file) {
  // strip down the message
  const text = report.text.replace(/! func=.*?, key=/, ' "') + '"'
  return {
    location: {
      file,
      position: report.range
    },
    severity: 'error',
    excerpt: text
  };
}

export default {
  activate() {
    let depCallbackID;
    this.idleCallbacks = new Set();
    const installLinterBigWigsDeps = () => {
      this.idleCallbacks.delete(depCallbackID);
      require('atom-package-deps').install('linter-lua-bigwigs');
      loadDeps();
    };
    depCallbackID = window.requestIdleCallback(installLinterBigWigsDeps);
    this.idleCallbacks.add(depCallbackID);

    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      atom.config.observe('linter-lua-bigwigs.executablePath', (value) => {
        this.executablePath = value;
      }),
    );
  },

  deactivate() {
    this.idleCallbacks.forEach(callbackID =>
      window.cancelIdleCallback(callbackID)
    );
    this.idleCallbacks.clear();

    this.subscriptions.dispose();
  },

  provideLinter() {
    return {
      name: 'BigWigs',
      grammarScopes: ['source.lua'],
      scope: 'file',
      lintsOnChange: false,

      lint: async (editor) => {
        const file = editor.getPath();

        if (!file || (file.indexOf('BigWigs') < 0 && file.indexOf('LittleWigs') < 0)) {
          return null;
        }

        loadDeps();

        // there's probably a better place to set this, but meh
        const packageDir = atom.packages.getActivePackage('linter-lua-bigwigs').path
        const params = [ path.join(packageDir, 'lib', 'parser.lua'), path.basename(file) ]

        const stdout = await helpers.exec(this.executablePath, params, {
          cwd: path.dirname(file),
          ignoreExitCode: true
        });

        return helpers.parse(stdout, pattern).map(v =>
          reportToMessage(v, file)
        );
      }
    };
  }
};
