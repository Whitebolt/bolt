'use strict';

/**
 * @module bolt/bolt
 */

const path = require('path');
const Promise = require('bluebird');
const readFile = Promise.promisify(require('fs').readFile);
const ejs = require('ejs');

const rxRelativeDir = /^\.\//;
const rxStartEndSlash = /^\/|\/$/g;


const templateFunctions = {
  /**
   * Component function for use inside ejs templates.
   *
   * @param {string} componentName            Component name.
   * @param {Object} doc                      The current doc.
   * @param {external:express:request} req    The current request object.
   * @param {Object} parent                   A parent object needed in called component (can be anything).
   */
  component: function (componentName, doc, req, parent) {
    let _componentName = ('/' + bolt.replaceSequence(componentName, [[rxRelativeDir, this.__componentName], ['//', '/']]));
    let method = _getMethod(_componentName, req.app);
    if (method) {
      Object.assign(this, {req, parent, doc});
      req.doc = req.doc || doc;
      bolt.fire("firingControllerMethod", bolt.annotation.get(method, 'methodPath'), bolt.getPathFromRequest(req));
      return method(this);
    } else {
      Promise.resolve('Could not find component: ' + componentName);
    }
  },

  /**
   * View function for use instead ejs template.
   *
   * @param {string} viewName                 View name.
   * @param {Object} doc                      The current doc.
   * @param {external:express:request} req    The current request object.
   * @param {Object} parent                   A parent object needed in called view (can be anything).
   * @returns {Promise.<string>}              The view applied to given document.
   */
  view: function (viewName, doc, req, parent) {
    let view = _getView2(viewName, this.__componentName, req);
    if (view) {
      bolt.fire("firingView", view.path, bolt.getPathFromRequest(req));
      return view.compiled(doc, req, parent);
    } else {
      Promise.resolve('Could not find view: ' + viewName);
    }
  }
};

/**
 * Load all the templates according to supplied options.
 *
 * @todo Does this need to execute in order using a special version of mapSeries?
 *
 * @private
 * @param {Object} options                                Options to use.
 * @param {string} [templateName=options.templateName]    Template name to get from.
 * @returns {Promise}                                     Prtomise resolving when all templates loaded.
 */
function _loadAllTemplates(options, templateName=options.templateName) {
  if (Array.isArray(templateName)) {
    return Promise.all(templateName.map(templateName => _loadAllTemplates(options, templateName)));
  }

  return Promise.all(_getTemplateDirectories(options.roots, templateName).map(templateDir => {
    return bolt.filesInDirectory(templateDir, 'ejs').map(viewPath => {
      let viewText = _loadViewText(viewPath, options);
      bolt.fire('loadedTemplate', viewPath);
      return viewText;
    });
  }));
}

/**
 * Pare the template options to a settings object that can be used.
 *
 * @private
 * @param {BoltApplication|BoltComponent} app     The bolt application that this applies to.
 * @param {Object} options                        The config options to parse in producing true config.
 * @returns {Object}
 */
function _parseLoadOptions(app, options={}) {
  const config = _getConfig(app) || {};

  let _options = Object.assign(options, {
    templateName: options.templateName || config.template,
    views: options.views || app.templates || {},
    roots: options.roots || config.root,
    delimiter: options.delimiter || '%',
    strict: true,
    _with: false,
    debug: false,
    awaitPromises: true
  });

  if (options.localsName !== false) _options.localsName = options.localsName || ['doc', 'req', 'parent'];
  if (options.locals !== false) _options.locals = options.locals || addTemplateFunctions();
  options.localsName = options.localsName || [];
  options.locals = options.locals || {};

  return _options;
}

/**
 * Get the application config
 *
 * @private
 * @param {BoltApplication|BoltComponent} app     The app or component to get config from.
 * @returns {BoltConfig}                          The bolt config object.
 */
function _getConfig(app) {
  return (app.config ? app.config : (app.parent ? _getConfig(app.parent) : undefined));
}

/**
 * Add template functions to given object binding to the object scope.
 *
 * @param {Object} locals     The object to add template methods to and bind to.
 * @returns {Object}          The mutated object.
 */
function addTemplateFunctions(locals = {}) {
  Object.keys(templateFunctions).forEach(funcName => {
    locals[funcName] = templateFunctions[funcName].bind(locals);
  });
  return locals;
}


/**
 * Get option values frm the component and return in object.
 *
 * @private
 * @param {BoltComponent} component     Component to get from.
 * @param {string} componentDir         Component directory.
 * @param {Object} parentOptions        Parent options to include in exported options.
 * @returns {Object}                    Options from parentOptions and those derived from the component.
 */
function _getComponentOptions(component, componentDir, parentOptions={}) {
  const options = Object.assign({}, parentOptions);
  options.views = component.views;
  options.roots = [componentDir];
  options.locals.__componentName = component.path;

  return options;
}

/**
 * Get an array of the template directories.
 *
 * @private
 * @param {Array|string} roots      Directories to look in.
 * @param {string} templateName     The template name we are looking for.
 * @returns {Promise.<string[]>}    Array of template directories.
 */
function _getTemplateDirectories(roots, templateName) {
  return Promise.all(bolt.directoriesInDirectory(roots, ['templates']).map(templateDir =>
    bolt.directoriesInDirectory(templateDir, bolt.makeArray(templateName))
  )).then(templateDirs => bolt.flatten(templateDirs))
}

/**
 * Get an array of the view directories.
 *
 * @private
 * @param {Array|string} roots          Directories to look in.
 * @param {string} [dirName='views']    The name of the views directories.
 * @returns {Promise.<string[]>}        Array of view directories.
 */
function _getViewFilenames(roots, dirName=['views']) {
  return Promise.all(bolt.directoriesInDirectory(roots, bolt.makeArray(dirName)).map(viewDir => {
    return bolt.filesInDirectory(viewDir, 'ejs');
  })).then(viewPaths=>bolt.flattenDeep(viewPaths));
}

/**
 * Load views from component directories.
 *
 * @private
 * @param {string} componentDir         Directory to search in.
 * @param {Object} componentOptions     Component options.
 * @returns {Promise.<string>}          Promise resolving to view text.
 */
function _loadComponentViews(componentDir, componentOptions) {
  return Promise.all(_getViewFilenames(componentDir).map(viewPath => {
    let viewText = _loadViewText(viewPath, componentOptions);
    bolt.fire('loadedComponentView', viewPath);
    return viewText;
  }));
}

/**
 * Get view text.
 *
 * @private
 * @param {string} filename       The view to load.
 * @param {Object} options        The view options.
 * @returns {Promise.<string>}    Promise resolving to vview text.
 */
function _loadViewText(filename, options) {
  let views = options.views;
  return readFile(filename, 'utf-8').then(viewTxt => {
    let viewName = path.basename(filename, '.ejs');
    views[viewName] = views[viewName] || {};
    views[viewName].text = viewTxt;
    views[viewName].path = filename;
    views[viewName].compiled = compileTemplate({text: views[viewName].text, filename, options});
    return viewTxt;
  });
}

/**
 * Get a template from the app.
 *
 * @private
 * @param {BoltApplication} app       The app to get from.
 * @param {Object} control            Control object.
 * @returns {Object}                  The template object.
 */
function _getTemplate(app, control) {
  return app.templates[control.template];
}

/**
 * Get a view
 *
 * @private
 * @param {BoltApplication} app     The application to get from.
 * @param {Object} control          The control object.
 * @param {Object} tag              The tag.
 * @returns {Object}                The view.
 */
function _getView(app, control, tag ={}) {
  const componentName = bolt.annotation.get(control, 'componentPath') || control.component || tag.component;
  const component = _getComponent(componentName, app);
  const viewName = control.view || tag.view;
  if (component && component.views[viewName]) return component.views[viewName];
}

/**
 * Get a given component from the given app.
 *
 * @private
 * @param {string} componentName      Name of component to get.
 * @param {BoltApplication} app       The bolt application.
 * @returns {BoltComponent}           The got component.
 */
function _getComponent(componentName, app) {
  if (componentName.indexOf('/') === -1) {
    return app.components[componentName];
  } else {
    let component = app;
    let components = componentName.split('/');
    while (components.length && component && component.components) {
      let componentName = components.shift();
      if (componentName !== '') {
        component = component.components[componentName];
      }
    }
    return ((components.length === 0)?component:undefined);
  }
}

/**
 * Apply a template to the given request, returning the text.
 *
 * @private
 * @param {Object} control                  The control object to use.
 * @param {external:express:request} req    The request instance to use.
 * @returns {Promise.<string>}              Promise resolving to text when templates appled.
 *
 */
function _applyTemplate(control, req) {
  let view = false;
  const app = req.app;
  const doc = control.doc || req.doc;
  const parent = control.parent || {};
  let template = _getTemplate(app, control);
  if (!template) {
    template = _getView(app, control);
    view = true;
  }

  if (template) {
    bolt.fire(
      view?"fireingView":"firingTemplate",
      template.path, bolt.getPathFromRequest(req)
    );
    return Promise.resolve(template.compiled(doc, req, parent));
  }

  return Promise.resolve('');
}

/**
 * Get all route paths for a given route.
 *
 * @private
 * @param {string} route      The path to search on.
 * @returns {Array}           All possible routes for given route.
 */
function _getPaths(route) {
  let routes = [];
  while (route.length) {
    routes.push(route);
    let routeParts = route.split('/');
    routeParts.pop();
    route = routeParts.join('/')
  }
  routes.push('/');
  return routes;
}

/**
 * Get a router method.
 *
 * @private
 * @param {string} route            The route we're looking for.
 * @param {BoltApplication} app     The bolt application.
 * @returns {Function}              The controller method.
 */
function _getMethod(route, app) {
  let methods = [];
  _getPaths(route).forEach(route => {
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].forEach(method => methods.push(method.method));
    }
  });
  return methods.shift();
}

/**
 * Get paths to template override directories that view has.
 *
 * @private
 * @param {BoltComponent} component     The component to use.
 * @returns {Array.<string>}            Override directory paths.
 */
function _getComponentOverridePaths(component) {
  let rootApp = bolt.getApp(component);
  let overridePaths = [];
  if (rootApp.config) {
    (rootApp.config.template || []).forEach(templateName => {
      (rootApp.config.root || []).forEach(
        root=>overridePaths.push(`${root}templates/${templateName}${component.filePath}`)
      );
    });
  }

  return overridePaths;
}

/**
 * Get a named view from a named component.
 *
 * @private
 * @param {string} viewName                 Name of view to load.
 * @param {string} componentName            Name of component toload from.
 * @param {external:express:request} req    Request instance to use and apply.
 * @returns {Object}                        The view.
 */
function _getView2(viewName, componentName, req) {
  let parts = viewName.split('/');
  let _viewName = parts.pop();
  let _componentName = bolt.replaceSequence(parts.join('/') + '/', [
    [rxRelativeDir, componentName],
    [rxStartEndSlash],
    ['/', '.components.']
  ]);
  return bolt.get(req, `app.components.${_componentName}.views.${_viewName}`);
}

/**
 * Load templates for given app.
 *
 * @private
 * @param {BoltApplication} app     Bolt application to use.
 * @param {Object} options          Template options.
 * @returns {Promise}               Promise resolving when all have loaded.
 */
function _loadTemplates(app, options) {
  options = _parseLoadOptions(app, options);
  if (!options.templateName || !options.roots) return app;
  app.applyTemplate = _applyTemplate;

  return _loadAllTemplates(options);
}

/**
 * Compile a passed in template.
 *
 * @param {Object} config                       Config for this operation.
 * @returns {TemplateFunction}   The template function.
 */
function compileTemplate(config) {
  let optionsTree = [{}];
  if (config.app) {
    optionsTree.push(_parseLoadOptions(config.app, config.options || {}));
  } else if (config.options) {
    optionsTree.push(config.options);
  }
  if (config.filename) optionsTree.push({filename: config.filename});
  return ejs.compile(config.text, Object.assign.apply(Object, optionsTree));
}

/**
 * Load views that override templates.
 *
 * @param {BoltComponent} component     Component to load from.
 * @returns {Promise}                   Promise resolving when views loaded.
 */
function loadComponentViewsTemplateOverrides(component) {
  return Promise.all(
    _getComponentOverridePaths(component).map(dirPath=>bolt.loadComponentViews(component, dirPath))
  );
}

/**
 * Load all the views for a given component.
 *
 * @public
 * @param {BoltComponent} component     The component to load from.
 * @param {string} dirPath              The directory path to use.
 * @returns {Promise.<string>}
 */
function loadComponentViews(component, dirPath) {
  const app = bolt.getApp(component);
  const componentOptions = _getComponentOptions(component, dirPath, _parseLoadOptions(app));
  return _loadComponentViews(dirPath, componentOptions).then(()=>app);
}

/**
 * Load templates according to given options.
 *
 * @public
 * @param {BoltApplication} app             The bolt application.
 * @param {Object} options                  Options to use.
 * @returns {Promise.<BoltApplication>}     The bolt application that was supplied.
 */
function loadTemplates(app, options={}) {
  return bolt.fire(()=>_loadTemplates(app, options), 'loadTemplates', app).then(()=>app);
}

/**
 * Load all the ejs files in a given subdirectory of all the root directories supplied.
 *
 * @public
 * @param {Array|string} roots      Root folders to search.
 * @param {string} dirName          Name of directory under roots to looki in.
 * @param {Object} options          Options to apply to the views
 * @returns {Promise.<Object>}      Promise resolving to all the loaded views.
 */
function loadEjsDirectory(roots, dirName, options={}) {
  let _options = _parseLoadOptions({}, Object.assign({roots}, options));
  return _getViewFilenames(roots, dirName)
    .map(filename=>_loadViewText(filename, _options))
    .then(()=>_options.views);
}

module.exports = {
  loadTemplates,
  loadComponentViews,
  loadComponentViewsTemplateOverrides,
  compileTemplate,
  loadEjsDirectory,
  addTemplateFunctions
};