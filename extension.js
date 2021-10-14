Numbas.addExtension("sqlite", ["jme"], function (extension) {
  let scope = extension.scope;

  // write your extension code here

  let jme = Numbas.jme;
  let sig = jme.signature;
  let delay = 10;

  let types = jme.types;
  let funcObj = jme.funcObj;
  let TString = types.TString;
  let TBool = types.TBool;
  let THTML = types.THTML;

  // ?? What is this used for?
  let container;
  $(document).ready(function () {
    container = document.createElement("div");
    container.setAttribute("id", "numbassqlitecontainer");
    container.setAttribute("class", "invisible");
    document.body.appendChild(container);
  });

  let TSQLEditor = function (data) {
    let a = this;
    this.worker = null; // ??
    this.el = null; // ??
    this.value = data;
    this.promise = data.promise; // ??
    this.container = data.element;

    this.promise.then(function (el, worker) {
      a.worker = worker;
      a.element = el;
    });
  };
  jme.registerType(TSQLEditor, "sqleditor", {
    html: function (v) {
      return new jme.types.THTML(v.container);
    },
  });

  let worker = () => {
    return new Worker(
      //"https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.1/worker.sql-wasm.js"
      "extensions/sqlite/standalone_scripts/worker.sql-wasm.js"
    );
  };

  // Performance measurement functions
  let tictime;
  if (!window.performance || !performance.now) {
    window.performance = { now: Date.now };
  }
  function tic() {
    tictime = performance.now();
  }
  function toc(msg) {
    var dt = performance.now() - tictime;
    console.log((msg || "toc") + ": " + dt + "ms");
  }

  // Run a command in the database
  function execute(worker, commands, on_result) {
    tic();
    worker.onmessage = (event) => on_result(event.data);
    /*function (event) {
      var results = event.data.results;
      toc("Executing SQL");
      if (!results) {
        error({ message: event.data.error });
        return;
      }
      

      tic();
      outputElm.innerHTML = "";
      for (var i = 0; i < results.length; i++) {
        outputElm.appendChild(
          tableCreate(results[i].columns, results[i].values)
        );
      }
      toc("Displaying results");
    
  };*/
    worker.postMessage({ action: "exec", sql: commands });
    //outputElm.textContent = "Fetching results...";
  }

  // TODO
  /** Load
   *
   * @returns {Promise} - resolves to the `GGBApplet` constructor.
   */
  let initializeStudentDbWorker = (setup_query) =>
    new Promise(function (resolve, reject) {
      let studentDbWorker = worker();
      execute(studentDbWorker, setup_query, (result) => {
        console.log("Initialized with response");
        console.log(result);
        if (!result.error) {
          resolve(studentDbWorker);
        } else {
          reject("Failed initializing the student database.");
        }
      });
    });

  /** Inject a sql editor in the document. Creates a `<textarea>` element to contain it.
   *
   * @param {Object} options - options for `GGBApplet`.
   * @returns {Promise} - resolves to an object `{worker, el}` - `worker` is the student db worker object, `el` is the container element.
   */
  var showEditor = function () {
    return new Promise(function (resolve, reject) {
      var element;
      element = document.createElement("textarea");
      container.appendChild(element);
      resolve(element);
    });
  };

  function SQLEditor(setup_query, correct_query) {
    let sql_editor = this;
    // create a container element, which we'll return
    // when the database has been loaded, we'll attach it to the container element ??
    let element = (this.element = document.createElement("div"));
    element.className = "numbas-sqlite-applet numbas-sqlite-loading";
    element.innerHTML = "Sqlite loading...";

    let promise = new Promise(function (resolve, reject) {
      let interval = setInterval(function () {
        if (element.parentNode) {
          clearInterval(interval);
          resolve();
        }
      }, delay);
    });

    this.setup_query = setup_query;
    this.correct_query = correct_query;

    promise = promise
      .then(function () {
        return initializeStudentDbWorker(setup_query);
      })
      .then(function (worker) {
        return showEditor().then((el) => (worker, el));
      });
    //.then(constructionFinished);
    //.then(eval_replacements(replacements)); ??
    this.promise = promise;
    /*if (parts && question) {
      question.signals.on("partsGenerated", function () {
        Object.keys(parts).forEach(function (key) {
          var path = parts[key];
          var part = question.getPart(path);
          if (!part) {
            throw new Numbas.Error(
              "The GeoGebra object " +
                key +
                " is supposed to link to the part with path " +
                parts[key] +
                ", but that doesn't exist."
            );
          }
          parts[key] = part;
        });
        promise
          .then(link_exercises_to_parts(parts))
          .then(link_objects_to_parts(parts));
      });
    }

    */

    promise
      .then(function (el, worker) {
        element.innerHTML = "";
        element.className = "numbas-sqlite-applet numbas-sqlite-loaded";
        element.appendChild(el);
      })
      .catch(function (e) {
        var msg = "Problem encountered when creating SQL Editor: " + e;
        element.className = "numbas-sqlite-applet numbas-sqlite-error";
        element.innerHTML = msg;
        throw new Numbas.Error(msg);
      });

    this.used_to_mark_parts = {};
  }

  // TODO documentation
  /** Create a SQLEditor with the given options
   *
   * @param {String} setup_query - The query used to setup the database
   * @param {String} correct_query - The correct query.
   * @returns {Promise} - Resolves to `{app, element, id}`, where `app` is the `GGBApplet` object, `element` is a container element, and `id` is the ID of the app.
   */
  createSQLEditor = extension.createSQLEditor = function (
    setup_query,
    correct_query
  ) {
    return new SQLEditor(setup_query, correct_query);
  };

  extension.scope.addFunction(
    new funcObj(
      "sqlite_editor",
      [TString, TString],
      TSQLEditor,
      null, // ??
      {
        evaluate: function (args, scope) {
          let setup_query = args[0];
          let correct_query = args[1];
          return new TSQLEditor(createSQLEditor(setup_query, correct_query));
        },
      },
      { unwrapValues: true }
    )
  );
});
