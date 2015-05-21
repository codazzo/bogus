define(['require'], function(require){
    'use strict';

    function isObject(value){
        return Object.prototype.toString.call(value) === '[object Object]';
    }

    // this is needed so we can stub define, when testing bogus
    if (!requirejs.define){
        requirejs.define = define;
    }

    var stubbed = [],
        modulesToCache = {},
        cached = {},
        originals = {};

    var origDefine = window.define;
    window.define = function(name, deps){
        origDefine.apply(this, arguments);
        var moduleName = document.currentScript && document.currentScript.dataset.requiremodule;

        if (modulesToCache[moduleName]) {
            //FIXME do proper args manipulation
            cached[moduleName] = {
                deps: name,
                factory: deps
            };
            delete modulesToCache[moduleName];
        }
    };
    window.define.amd = origDefine.amd;

    function preserveDefinition(name){
        if (requirejs.defined(name) && !originals[name]){
            originals[name] = requirejs(name);
        }
    }

    function stub(name, implementation){
        if (stubbed.indexOf(name) !== -1){
            throw new Error('Cannot stub module "' + name + '" twice');
        }

        preserveDefinition(name);
        stubbed.push(name);

        requirejs.undef(name);

        requirejs.define(name, [], function(){
            return implementation;
        });
    }

    function stubOneOrMany(){
        var stubOne  = typeof arguments[0] === 'string' && arguments[1] !== undefined,
            stubMany = isObject(arguments[0]),
            map = stubMany && arguments[0],
            key;

        if (stubOne){
            stub(arguments[0], arguments[1]);
            return;
        }

        if (stubMany){
            for (key in map){
                if (map.hasOwnProperty(key)){
                    stub(key, map[key]);
                }
            }
            return;
        }

        throw new Error('stub method expects either an Object as a map of names and implementations, or a single name/implementation pair as arguments');
    }

    function requireWithStubs(name, callback, errback){
        // Cache the current index of the module in the array.
        var moduleInCache = cached[name];

        preserveDefinition(name);
        requirejs.undef(name);

        if (!moduleInCache) {
            stubbed.push(name);
            modulesToCache[name] = true;
        }

        // Require all the dependencies to ensure that they're registered.
        require(stubbed, function () {
            var module,
                args;

            if (moduleInCache) {
                args = moduleInCache.deps.map(function(depName){
                    return  require(depName);
                });
                module = moduleInCache.factory.apply(null, args);

                define(name, moduleInCache.deps, function(){
                    return module;
                });
                stubbed.push(name); //restore it later
            } else {
                module  = arguments[arguments.length -1];
            }

            callback(module); // Return the required module.
        }, errback);
    }

    function reset(callback){
        var originalsToRestore = [];

        if (stubbed.length === 0) {
            callback();
            return;
        }

        stubbed.forEach(function(name){
            requirejs.undef(name);

            if (originals[name]){
                requirejs.define(name, [], function(){
                    return originals[name];
                });
                originalsToRestore.push(name);
            }
        });

        // require the module in order to trigger requirejs to commit to defining it
        require(originalsToRestore, function(){
            stubbed = [];
            callback();
        });
    }

    return {
        stub: stubOneOrMany,
        requireWithStubs: requireWithStubs,
        reset: reset
    };
});
