'use strict';
var _ = require('lodash');
var yeoman = require('yeoman-generator');
var path = require('path');
var yosay = require('yosay');
var elementNameValidator = require('validate-element-name');
var chalk = require('chalk');

module.exports = yeoman.Base.extend({
  constructor: function () {
    yeoman.Base.apply(this, arguments);

    this.argument('element-name', {
      desc: 'Tag name of the element and directory to generate.',
      required: true
    });

    this.option('skip-install', {
      desc: 'Whether bower dependencies should be installed',
      defaults: false
    });

    this.option('skip-install-message', {
      desc: 'Whether commands run should be shown',
      defaults: false
    });

    this.sourceRoot(path.join(path.dirname(this.resolved), 'templates/tpa-seed'));
  },
  validate: function () {
    this.elementName = this['element-name'];
    var result = elementNameValidator(this.elementName);

    if (!result.isValid) {
      this.emit('error', new Error(chalk.red(result.message)));
    }

    if (result.message) {
      console.warn(chalk.yellow(result.message + '\n'));
    }

    return true;
  },
  askFor: function () {
    var done = this.async();

    // Have Yeoman greet the user.
    this.log(yosay('Out of the box I include Polymer\'s tpa-seed-element.'));

    var prompts = [{
        name: 'ghUser',
        message: 'What is your GitHub username?'
      }, {
        name: 'includeWCT',
        message: 'Would you like to include web-component-tester?',
        type: 'confirm'
      }
    ];

    this.prompt(prompts, function (props) {
      this.ghUser = props.ghUser;
      this.includeWCT = props.includeWCT;

      // Save user's GitHub name for when they want to use gh subgenerator
      this.config.set({
        ghUser: this.ghUser
      });
      this.config.save();

      done();
    }.bind(this));

  },
  tpa: function () {

    // Process function to replace 'tpa-seed-element' in template files
    // with actual element name
    var renameElement = function (file) {
      file = file.toString();
      return file.replace(/tpa-seed-element/g, this.elementName);
    }.bind(this);

    this.fs.copy([
        this.templatePath() + '/**',
        this.templatePath() + '/**/.*'],
      this.destinationPath(),
      {
        process: renameElement,
        globOptions: {
          ignore: [
            '**/{bower.json,tpa-seed-element.html,.npmignore}',
            '**/{test,.git}/**'
          ]
        }
      });

    this.fs.copy(
      this.templatePath('tpa-seed-element.html'),
      this.destinationPath(this.elementName + '.html'),
      { process: renameElement });

    // Remove WCT if the user opted out
    this.fs.copy(
      this.templatePath('bower.json'),
      this.destinationPath('bower.json'),
      { process: function (file) {
        var manifest =  JSON.parse(file.toString());
        manifest.name = this.elementName;
        manifest.main = this.elementName + '.html';
        manifest.license.replace(/polymer/g, this.ghUser);
        manifest.homepage.replace(/<USERNAME>/g, this.ghUser);
        manifest.homepage.replace(/tpa-seed-element/g, this.elementName);
        if (!this.includeWCT) {
          delete manifest.devDependencies['web-component-tester'];
        }
        return JSON.stringify(manifest, null, 2);
      }.bind(this) });

    if (this.includeWCT) {
      this.fs.copy(
        this.sourceRoot() + '/test/*',
        this.destinationPath('test'),
        { process: renameElement });
    }

    // Handle bug where npm has renamed .gitignore to .npmignore
    // https://github.com/npm/npm/issues/3763
    if (this.fs.exists(this.templatePath('.npmignore'))) {
      this.fs.copy(
        this.templatePath('.npmignore'),
        this.destinationPath('.gitignore')
      );
    } else {
      this.fs.copy(
        this.templatePath('.gitignore'),
        this.destinationPath('.gitignore')
      );
    }

  },
  install: function () {
    this.installDependencies({
      npm: false,
      skipInstall: this.options['skip-install'],
      skipMessage: this.options['skip-install-message']
    });
  }
});
