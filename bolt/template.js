'use strict';

const path = require('path');
const Promise = require('bluebird');
const readFile = Promise.promisify(require('fs').readFile);
const ejs = require('ejs');

const rxRelativeDir = /^\.\//;
const rxStartEndSlash = /^\/|\/$/g;


const templateFunctions = {
  component: function (componentName, doc, req, parent) {
    let _componentName = ('/' + componentName.replace(rxRelativeDir, this.__componentName)).replace('//', '/');
    let method = _getMethod(_componentName, req.app);
    if (method) {
      req.doc = req.doc || doc;
      bolt.fire("firingControllerMethod", method.methodPath, bolt.getPathFromRequest(req));
      return method({req, doc, parent, component:this.component, view:this.view});
    } else {
      Promise.resolve('Could not find component: ' + componentName);
    }
  },

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
 * @todo Does this need to execute in order using a special version of mapSeries?
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
  if (options.locals !== false) _options.locals = options.locals || _createLocalsObject();
  options.localsName = options.localsName || [];
  options.locals = options.locals || {};

  return _options;
}

function _getConfig(app) {
  return (app.config ? app.config : (app.parent ? _getConfig(app.parent) : undefined));
}

function _createLocalsObject(locals = {}) {
  Object.keys(templateFunctions).forEach(funcName => {
    locals[funcName] = templateFunctions[funcName].bind(locals);
  });
  return locals;
}

function _getComponentOptions(component, componentDir, parentOptions = {}) {
  const options = Object.assign({}, parentOptions);
  options.views = component.views;
  options.roots = [componentDir];
  options.locals.__componentName = component.path;

  return options;
}

function _getTemplateDirectories(roots, templateName) {
  return Promise.all(bolt.directoriesInDirectory(roots, ['templates']).map(templateDir =>
    bolt.directoriesInDirectory(templateDir, bolt.makeArray(templateName))
  )).then(templateDirs => bolt.flatten(templateDirs))
}

function _getViewFilenames(roots, dirName=['views']) {
  return Promise.all(bolt.directoriesInDirectory(roots, bolt.makeArray(dirName)).map(viewDir => {
    return bolt.filesInDirectory(viewDir, 'ejs');
  })).then(viewPaths=>bolt.flattenDeep(viewPaths));
}

function _loadComponentViews(componentDir, componentOptions) {
  return Promise.all(_getViewFilenames(componentDir).map(viewPath => {
    let viewText = _loadViewText(viewPath, componentOptions);
    bolt.fire('loadedComponentView', viewPath);
    return viewText;
  }));
}

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

function _getTemplate(app, control) {
  return app.templates[control.template];
}

function _getView(app, control, tag = {}) {
  const componentName = control.componentPath || control.component || tag.component;
  const component = _getComponent(componentName, app);
  const viewName = control.view || tag.view;
  if (component && component.views[viewName]) {
    return component.views[viewName];
  }
}

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

function _getMethod(route, app) {
  let methods = [];
  _getPaths(route).forEach(route => {
    if (app.controllerRoutes[route]) {
      app.controllerRoutes[route].forEach(method => methods.push(method.method));
    }
  });
  return methods.shift();
}

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

function _getView2(viewName, componentName, req) {
  let parts = viewName.split('/');
  let _viewName = parts.pop();
  let _componentName = (parts.join('/') + '/')
    .replace(rxRelativeDir, componentName)
    .replace(rxStartEndSlash, '')
    .replace('/', '.components.');
  return bolt.get(req, `app.components.${_componentName}.views.${_viewName}`);
}

function _loadTemplates(app, options) {
  options = _parseLoadOptions(app, options);
  if (!options.templateName || !options.roots) return app;
  app.applyTemplate = _applyTemplate;

  return _loadAllTemplates(options);
}

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

function loadComponentViewsTemplateOverrides(component) {
  return Promise.all(
    _getComponentOverridePaths(component).map(dirPath=>bolt.loadComponentViews(component, dirPath))
  );
}

function loadComponentViews(component, dirPath) {
  const app = bolt.getApp(component);
  const componentOptions = _getComponentOptions(component, dirPath, _parseLoadOptions(app));
  return _loadComponentViews(dirPath, componentOptions).then(()=>app);
}

function loadTemplates(app, options = {}) {
  return bolt.fire(()=>_loadTemplates(app, options), 'loadTemplates', app).then(() => app);
}

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
  loadEjsDirectory
};