(function(window) {  
  var nada = function() {},
      defaults  = { protocol : 'https'
                  , domain   : 'mite.yo.lk'
                  , account  : ''
                  , api_key  : ''
                  , async    : true
                  , timeout  : 60 // 1 minute
                  , onerror  : nada
                  };
  
  window.miteQuery = (function() {
    
    ////
    //  Private
    var get_url_for, json_parse, not_allowed,
        _request, _get, _post, _put, _destroy,
        _buildQuery, _parse,
        account, myself, TimeEntry, Tracker, Bookmark, Customer, Project, Service, User,
        config = {};
    
    // build URL for API request
    get_url_for = function(path) {
      return config.protocol + '://' + 'corsapi.' + config.domain + '/' + path + '.json';
    };
    
    // parse string to JSON
    json_parse = function(string) {
      return ( /^\s*$/.test(string) ) ? {} : JSON.parse(string);
    };
    
    // through Errors for operations that are not allowed over the mite.API
    not_allowed = function() {
      throw new Error('not allowed over API');
    };  
    
    // build a query out of an associative array
    _buildQuery = function(json) {
      if (!json) return "";
      
      var params = [];
      for(key in json) {
        params.push([encodeURIComponent(key),encodeURIComponent(json[key])].join('='));
      }
      return params.join('&');
    };
    
    _parse = function(options) {
      if (!options) options = {};
      if (typeof options == 'function') { options = {success: options}; };
      return options;
    };
    
    // ajax call wrapper
    _request = function(method, path, options) {
      var xhr         = new XMLHttpRequest(),
          data        = options.data      || null,
          async       = (typeof options.async == 'boolean') ? options.async : config.async,
          timeout     = options.timeout   || config.timeout,
          onsuccess   = options.success   || nada,
          onerror     = options.error     || config.onerror,
          oncomplete  = options.complete  || nada,
          timeout_handler, user_input;
          
      xhr.onreadystatechange = function(){
        var status = 200;
        if (xhr.readyState == 4) {
          
          
          // corsapi.mite.yo.lk does always return a 200 status code due to a
          // Firefox bug, that always returns a status code 0 if there is an error.
          if (/^\d\d\d$/.test(xhr.responseText)) status = parseInt(xhr.responseText, 10);
          
          switch(status) {
            case 200:
              if(xhr.responseText) {
                onsuccess( json_parse(xhr.responseText) );
              } else {
                onerror(xhr, xhr.responseText || 'error');
              }
              break;
            case 401:
              user_input = prompt('Could not login. Please confirm your API key:', config.api_key);
              xhr.abort();
              if (user_input && user_input != config.api_key) {
                config.api_key = user_input;
                _request(method, path, options);
              }
              break;
            case 404:
              user_input = prompt('Could not find your account ('+config.protocol + '://' + config.account + '.' + config.domain+'):', config.account);
              xhr.abort();
              if (user_input && user_input != config.api_key) {
                config.account = user_input;
                _request(method, path, options);
              }
              break;
            default:
              onerror(xhr, xhr.responseText || 'error');
          }
          oncomplete(xhr);
          if (timeout_handler) clearTimeout(timeout_handler);
        }
      };
      
      if (options.error) timeout_handler = setTimeout(function() {
        onerror(xhr, 'timeout');
      }, timeout * 1000);
      
      xhr.open(method,get_url_for(path),async);
      if (data instanceof Object) {
        data = JSON.stringify(data);
        xhr.setRequestHeader('Content-Type','application/json');
      }
      
      xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
      xhr.setRequestHeader("X-MiteApiKey",  config.api_key);     
      xhr.setRequestHeader("X-MiteAccount", config.account);     
      xhr.send(data);
      
      if (!config.async) return json_parse(xhr.responseText);
    };
    
    // GET request
    _get = function(path, options) {
      var parsed_options  = _parse(options),
          separator       = /\?/.test(path) ? '&' : '?';
      
      if (parsed_options.data) {
        path += separator + _buildQuery(parsed_options.data);
        delete(parsed_options.data); 
      }
      
      return _request('GET', path, parsed_options);
    };
    
    // POST request
    _post = function(path, params, options) {
      var parsed_options  = _parse(options);
      parsed_options.data = params;
      return _request('POST', path, parsed_options);
    };
    
    // PUT request
    _put = function(path, params, options) {
      var parsed_options  = _parse(options);
      parsed_options.data = params;
      return _request('PUT', path, parsed_options);
    };
    
    // destroy request
    _destroy = function(path, options) {
      return _request('destroy', path, _parse(options));
    };
    
    // http://mite.yo.lk/en/api/account.html
    account             = function(options)              { return    _get('account',                                options); };
    myself              = function(options)              { return    _get('myself',                                 options); };
        
    // http://mite.yo.lk/en/api/time-entries.html
    // see also: http://mite.yo.lk/en/api/grouped-time-entries.html
    TimeEntry = {
      all               : function(options)              { return    _get('time_entries',                           options); },
      find              : function(id, options)          { return    _get('time_entries/'+id,                       options); },
      create            : function(params, options)      { return   _post('time_entries',     {time_entry: params}, options); },
      update            : function(id, params, options)  { return    _put('time_entries/'+id, {time_entry: params}, options); },
      destroy            : function(id, options)          { return _destroy('time_entries/'+id,                       options); }
    };
    
    // http://mite.yo.lk/en/api/tracker.html
    Tracker = {
      find              : function(options)              { return    _get('tracker',                                options); },
      start             : function(id, options)          { return    _put('tracker/'+id,                        {}, options); },
      stop              : function(id, options)          { return _destroy('tracker/'+id,                            options); }
    };
    
    // http://mite.yo.lk/en/api/bookmarks.html
    Bookmark = {
      all               : function(options)              { return    _get('time_entries/bookmarks',                 options); },
      find              : function(id, options)          { return    _get('time_entries/bookmarks/'+id,             options); },
      
      // TODO fix me (I guess it relates to the redirect)
      time_entries_for  : function(id, options)          { return    _get('time_entries/bookmarks/'+id+'/follow',   options); },
      
      create            : not_allowed,
      update            : not_allowed,
      destroy            : not_allowed
    };
        
    // http://mite.yo.lk/en/api/customers.html
    Customer = {
      active            : function(options)              { return    _get('customers',                              options); },
      archived          : function(options)              { return    _get('customers/archived',                     options); },
      find              : function(id, options)          { return    _get('customers/'+id,                          options); },
      create            : function(params, options)      { return   _post('customers',          {customer: params}, options); },
      update            : function(id, params, options)  { return    _put('customers/'+id,      {customer: params}, options); },
      destroy            : function(id, options)          { return _destroy('customers/'+id,                          options); },
      projects_for      : function(ids, options)         { return    _get('projects?customer_id='+ids,              options); },
      time_entries_for  : function(ids, options)         { return    _get('time_entries?customer_id='+ids,          options); }
    };
    
    // http://mite.yo.lk/en/api/projects.html
    Project = {
      active            : function(options)              { return    _get('projects',                               options); },
      archived          : function(options)              { return    _get('projects/archived',                      options); },
      find              : function(id, options)          { return    _get('projects/'+id,                           options); },
      create            : function(params, options)      { return   _post('projects',           {project: params},  options); },
      update            : function(id, params, options)  { return    _put('projects/'+id,       {project: params},  options); },
      destroy            : function(id, options)          { return _destroy('projects/'+id,                           options); },
      time_entries_for  : function(ids, options)         { return    _get('time_entries?project_id='+ids,           options); }
    };
    
    // http://mite.yo.lk/en/api/services.html
    Service = {
      active            : function(options)              { return    _get('services',                               options); },
      archived          : function(options)              { return    _get('services/archived',                      options); },
      find              : function(id, options)          { return    _get('services/'+id,                           options); },
      create            : function(params, options)      { return   _post('services',           {service: params},  options); },
      update            : function(id, params, options)  { return    _put('services/'+id,       {service: params},  options); },
      destroy            : function(id, options)          { return _destroy('services/'+id,                           options); },
      time_entries_for  : function(ids, options)         { return    _get('time_entries?service_id='+ids,           options); }
    };
    
    // http://mite.yo.lk/en/api/users.html
    User = {
      active            : function(params, options)      { return    _get('users',                                  options); },
      archived          : function(params, options)      { return    _get('users/archived',                         options); },
      find              : function(id, options)          { return    _get('users/'+id,                              options); }, 
      time_entries_for  : function(ids, options)         { return    _get('time_entries?user_id='+ids,              options); },
    
      create            : not_allowed,
      update            : not_allowed,
      destroy            : not_allowed
    };
    
    //// 
    //  Public
    var Interface = function(options) {
      if (!options || !options.account || !options.api_key) throw "account & api_key need to be set";
      
      config.protocol = options.protocol || defaults.protocol;
      config.domain   = options.domain   || defaults.domain;
      config.account  = options.account  || defaults.account;
      config.api_key  = options.api_key  || defaults.api_key;
      config.async    = options.async    || defaults.async;
      config.timeout  = options.timeout  || defaults.timeout;
      config.onerror  = options.onerror  || defaults.timeout;
      
      this.config     = config;
    };
    
    Interface.prototype = {
      // resources
      account   : account,
      myself    : myself,
      TimeEntry : TimeEntry,
      Tracker   : Tracker,
      Bookmark  : Bookmark,
      Customer  : Customer,
      Project   : Project,
      Service   : Service,
      User      : User
    };
    return Interface;
  }());
}(window));