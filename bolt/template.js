'use strict';

/**
 * @module bolt/bolt
 */

const path = require('path');
const ejs = require('ejs');
const babel = require('babel-core');

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
  component: async function (componentName, doc={}, req={}, parent={}) {
    let _componentName = ('/' + bolt.replaceSequence(componentName, [[rxRelativeDir, this.__componentName], ['//', '/']]));
    let method = _getMethod(_componentName.split('?').shift(), req.app);

    if (method) {
      req.doc = req.doc || doc;
      const proxiedReq = new Proxy(req, {
        get: function(target, property, receiver) {
          if (property === 'doc') return doc;
          return Reflect.get(target, property, receiver);
        }
      });
      this.viaView = true;
      this.viaViewPath = _componentName;
      Object.assign(this, {req:proxiedReq, parent, doc});
      bolt.emit("firingControllerMethod in template", bolt.annotation.get(method, 'methodPath'), bolt.getPathFromRequest(req));
      return method(this);
    } else {
      return 'Could not find component: ' + componentName;
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
  view: async function (viewName, doc, req, parent) {
    let view = _getViewFromPath(viewName, this.__componentName, req);
    if (view) {
      bolt.emit("firingView", view.path, bolt.getPathFromRequest(req));
      return view.compiled(doc, req, parent);
    } else {
      return 'Could not find view: ' + viewName;
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
  return loadEjsDirectory(
    _getDirectoryPaths(options.roots, 'templates'),
    templateName,
    options,
    'loadedTemplate'
  );
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
 * Load views from component directories.
 *
 * @private
 * @param {string} roots          Directory to search in.
 * @param {Object} options        Component options.
 * @returns {Promise.<Function>}  Promise resolving to compiled view
 */
function _loadComponentViews(roots, options) {
  return loadEjsDirectory(roots, 'views', options, 'loadedComponentView');
}

function viewOnload(filename, compiled, views) {
  let viewName = path.basename(path.basename(filename, '.ejs'), '.jsx');
  views[viewName] = views[viewName] || {};
  views[viewName].path = filename;
  views[viewName].compiled = compiled;
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
 * Get a view from a router object.
 *
 * @private
 * @param {BoltApplication} app     The application to get from.
 * @param {Object} router           The router object.
 * @param {Object} tag              The tag.
 * @returns {Object}                The view.
 */
function _getView(app, router, tag ={}) {
  const componentName = bolt.annotation.get(router, 'componentPath') || router.componentPath || tag.componentPath;
  const component = _getComponent(componentName, app);
  const viewName = router.view || tag.view;
  if (component && component.views[viewName]) return component.views[viewName];
}

/**
 * Get a named view from a supplied path.
 *
 * @private
 * @param {string} viewName                 Name of view to load.
 * @param {string} componentName            Name of component toload from.
 * @param {external:express:request} req    Request instance to use and apply.
 * @returns {Object}                        The view.
 */
function _getViewFromPath(viewName, componentName, req) {
  return (req.app.templates.hasOwnProperty(viewName) ?
    req.app.templates[viewName] :
    _getAppViewFromPath(req.app, getComponentViewPath(viewName, componentName))
  );
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
 * @param {Object} router                                The router object to use.
 * @param {external:express:request} [req=router.req]    The request instance to use.
 * @returns {Promise.<string>}                           Promise resolving to text when templates appled.
 *
 */
async function _applyTemplate(router, req=router.req) {
  let view = false;
  const app = req.app || router.req;
  const doc = router.doc || req.doc;
  const parent = router.parent || {};
  let template = _getTemplate(app, router);
  if (!template) {
    template = _getView(app, router);
    view = true;
  }

  if (!template) return '';
  bolt.emit(view?"fireingView":"firingTemplate", template.path, bolt.getPathFromRequest(req));
  return template.compiled(doc, req, parent);
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
  _getPaths(route).forEach(route=>{
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].sort(bolt.prioritySorter).forEach(method=>methods.push(method.method));
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

function _getAppViewFromPath(app, path) {
  let componentPath = `${path.component}`;
  if (componentPath !== '') return bolt.get(app, `components.${path.component}.views.${path.view}`);
  return bolt.get(app, `components.${path.view}.views.index`);
}

function getComponentViewPath(viewName, componentName) {
  let parts = viewName.split('/');
  let view = parts.pop();
  let component = bolt.replaceSequence(parts.join('/') + '/', [
    [rxRelativeDir, componentName],
    [rxStartEndSlash],
    ['/', '.components.']
  ]);

  return {
    view, component
  }
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
 * @param {Object} config        Config for this operation.
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
  return bolt.emitThrough(()=>_loadTemplates(app, options), 'loadTemplates', app).then(()=>app);
}

/**
 * Load all the ejs files in a given subdirectory of all the root directories supplied.
 *
 * @public
 * @param {Array|string} roots      Root folders to search.
 * @param {string} dirName          Name of directory under roots to look in.
 * @param {Object} options          Options to apply to the views
 * @returns {Promise.<Object>}      Promise resolving to all the loaded views.
 */
async function loadEjsDirectory(roots, dirName, options={}, eventName) {
  let _options = _parseLoadOptions({}, Object.assign({roots}, options));
  const dirs = _getDirectoryPaths(roots, dirName);

  await require.import(dirs, {
    options:options,
    extensions:['.ejs', '.jsx'],
    basedir:__dirname,
    parent: __filename,
    onload: (filename, compiled)=>{
      viewOnload(filename, compiled, options.views);
      if (eventName) bolt.emit(eventName, filename)
    }
  });

  return _options.views;
}

function _getDirectoryPaths(roots, dirName) {
  return bolt.flattenDeep(bolt.makeArray(roots).map(
    root=>bolt.makeArray(dirName).map(dir=>`${root}/${dir}/`.replace(/\/+/g, '/'))
  ));
}

function getControllerMethodProperty(method, property) {
  if (method[property]) return method[property];
  const sourceMethod = bolt.annotation.get(method, 'sourceMethod');
  if (sourceMethod[property]) return sourceMethod[property];
  return bolt.annotation.get(method, property) || bolt.annotation.get(sourceMethod, property);
}

module.exports = {
  loadTemplates,
  loadComponentViews,
  loadComponentViewsTemplateOverrides,
  compileTemplate,
  loadEjsDirectory,
  addTemplateFunctions,
  getControllerMethodProperty
};
