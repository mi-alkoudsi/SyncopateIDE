'use babel';

import {
  CompositeDisposable
} from 'atom';

export default {
  subscriptions: null,
  outputPath: "",
  activePane: null,
  linterSubscriptions: null,
  linterMessages: {},
  lastLintedFiles: {},
  descamLinter: null,
  isLintOnSave: true,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.linterSubscriptions = new CompositeDisposable();
    this.subscriptions = new CompositeDisposable();
    this.isLintOnSave = atom.config.get('descam.LintOnSave');
    // Register commands for the buttons added in the context and packages menus
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'descam:help': () => this.runPlugin("h"),
      'descam:printITL': () => this.runPlugin("PrintITL"),
      'descam:printTrueOperation': () => this.runPlugin("PrintTrueOperation"),
      'descam:printSkeleton': () => this.runPlugin("PrintSkeleton"),
      'descam:printChisel': () => this.runPlugin("PrintChisel"),
      'descam:printCFGDot': () => this.runPlugin("PrintCFGDot"),
      'descam:printCompleteness': () => this.runPlugin("PrintCompleteness"),
      'descam:printSVA': () => this.runPlugin("PrintSVA"),
      'descam:toggleLintOnSave': () => this.toggleLintOnSave()
      //add more commands here
    }));
    //this.subscriptions.add(atom.workspace.onDidDestroyPaneItem(this.removeDotFile()));
    require('atom-package-deps').install('linter');
    if (!atom.packages.getLoadedPackages("linter") && !atom.packages.getLoadedPackages("atom-ide-ui")) {
      atom.notifications.addError(
        "Neither Linter nor atom-ide-ui packages were found.", {
          detail: "The `linter` or `atom-ide-ui` package need to be installed first"
        }
      );
    }
  },
  deactivate() {
    this.activePane = null;
    this.subscriptions.dispose();
    this.linterSubscriptions.dispose();
  },
  serialize() {},

  toggleLintOnSave() {
    if (this.isLintOnSave) {
      this.isLintOnSave = false;
    } else {
      this.isLintOnSave = true;
      this.linterMessages = {};
    }
  },

  async runPlugin(pluginName) {
    try {
      const utilities = require('./utilities');
      const descamInterface = require('./descamInterface');
      const result = await descamInterface.pluginAction(pluginName);
      if (result !== "") {
        if (pluginName !== "h") {
          let outputFilesDir = `${this.outputPath}/DESCAM_OUTPUT/${pluginName}`;
          const fileExists = await utilities.checkIfFileExists(outputFilesDir);
          if (fileExists) {
            let filesInOutputDir = await utilities.getFilesInDir(outputFilesDir);
            //  console.log(filesInOutputDir);
            filesInOutputDir.forEach((file) => {
              if (file !== "") {
                let filePath = `${outputFilesDir}/${file}`;
                utilities.openFile(filePath);
                if (pluginName === "PrintCFGDot") {
                  setTimeout(utilities.renderDotGraph, 2000)
                }
              }
            });
          }
        }else{
          utilities.createNewTab(result);
        }
      }
    } catch (error) {
      console.log(error);
    }
  },
  consumeLinter: function(registerIndie) {
    this.descamLinter = registerIndie({
      name: 'DeSCAM'
    })
    const utilities = require("./utilities");
    const descamInterface = require('./descamInterface');
    lintOnSave = () => {
      if (!this.isLintOnSave) return;
      module.exports.lastLintedFiles = new Set([])
      editor = utilities.getCppEditor(atom.workspace.getActiveTextEditor());
      if (!editor) return;
      filePath = editor.getPath();
      //remove lint messages from this file
      for (let file in this.linterMessages) {
        if (!this.linterMessages.hasOwnProperty(file)) continue;
        var fileMsgs = this.linterMessages[file];
        for (let msg in fileMsgs) {
          if (!fileMsgs.hasOwnProperty(msg)) continue;
          var message = fileMsgs[msg];
          if (message.location.file === filePath) {
            delete fileMsgs[msg];
          }
        }
      }
      descamInterface.lint(filePath);
    };
    deleteMessages = (() => {
      if (!this.isLintOnSave) {
        this.descamLinter.setAllMessages([]);
        return;
      }
      filesPathsInUse = {};
      atom.workspace.getTextEditors().forEach((entry) => {
        try {
          path = entry.getPath()
        } catch (err) {}
        filesPathsInUse[entry.getPath()] = 1;
      });
      for (let file in this.linterMessages) {
        if (!filesPathsInUse.hasOwnProperty(file)) {
          delete this.linterMessages[file]
        }
      }
      let messages = require("./utilities").makeValuesArrayFromObject(this.linterMessages);
      this.descamLinter.setAllMessages(messages);
    });
    this.linterSubscriptions.add(this.descamLinter)
    atom.workspace.observeTextEditors((editor) => {
      this.linterSubscriptions.add(editor.onDidSave(lintOnSave))
      this.linterSubscriptions.add(editor.onDidDestroy(deleteMessages))
    });
  },
};
