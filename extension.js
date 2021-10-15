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
  function execute_promise(worker, commands) {
    console.log("Executing ");
    console.log(commands);
    return new Promise((resolve, reject) => {
      worker.onmessage = (event) => resolve(event.data);
      worker.postMessage({ action: "exec", sql: commands });
    });
  }

  // Run a command in the database
  function execute(worker, commands, on_message) {
    console.log("Executing ");
    console.log(commands);
    worker.onmessage = (event) => on_message(event.data);
    worker.postMessage({ action: "exec", sql: commands });
  }

  // TODO
  /** Load
   *
   * @returns {Promise} - resolves to the `GGBApplet` constructor.
   */
  let initializeStudentDbWorker = (setup_query) => {
    let studentDbWorker = worker();
    return execute_promise(studentDbWorker, setup_query).then((result) => {
      console.log("Initialized with response");
      console.log(result);
      if (!result.error) {
        return studentDbWorker;
      } else {
        throw "Failed initializing the student database.";
      }
    });
  };

  // Create an HTML table
  // From https://github.com/sql-js/sql.js/blob/master/examples/GUI/gui.js#L51
  let tableCreate = (function () {
    function valconcat(vals, tagName) {
      if (vals.length === 0) return "";
      var open = "<" + tagName + ">",
        close = "</" + tagName + ">";
      return open + vals.join(close + open) + close;
    }
    return function (columns, values) {
      var tbl = document.createElement("table");
      var html = "<thead>" + valconcat(columns, "th") + "</thead>";
      var rows = values.map(function (v) {
        return valconcat(v, "td");
      });
      html += "<tbody>" + valconcat(rows, "tr") + "</tbody>";
      tbl.innerHTML = html;
      return tbl;
    };
  })();

  /** Inject a sql editor in the document. Creates a `<textarea>` element to contain it.
   *
   * @param {Object} options - options for `GGBApplet`.
   * @returns {Promise} - resolves to an object `{worker, el}` - `worker` is the student db worker object, `el` is the container element.
   */
  var showEditor = function (worker) {
    return new Promise(function (resolve, reject) {
      let element = document.createElement("div");
      let textarea = document.createElement("textarea");
      let button = document.createElement("button");
      button.innerHTML = "execute";
      let result = document.createElement("div");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        execute_promise(worker, textarea.value).then((data) => {
          let results = data.results;
          if (!results) {
            result.innerHTML = data.error;
          } else {
            result.innerHTML = "";
            for (var i = 0; i < results.length; i++) {
              result.appendChild(
                tableCreate(results[i].columns, results[i].values)
              );
            }
          }
        });
      });
      element.appendChild(textarea);
      element.appendChild(button);
      element.appendChild(result);
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
        return showEditor(worker).then((el) => (worker, el));
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
          let setup_query = args[0].value;
          let correct_query = args[1].value;
          return new TSQLEditor(createSQLEditor(setup_query, correct_query));
        },
      },
      { unwrapValues: true }
    )
  );
  extension.scope.addFunction(
    new funcObj(
      "check_resultset",
      [TSQLEditor],
      TBool,
      null, // ??
      {
        evaluate: function (args, scope) {
          let sql_editor = args[0].value;
          let current_query =
            sql_editor.element.getElementsByTagName("textarea")[0].value;
          let correct_worker = worker();
          let student_result_worker = worker();

          function run(generatorFunction) {
            var generatorItr = generatorFunction(resume);
            function resume(callbackValue) {
              generatorItr.next(callbackValue);
            }
            generatorItr.next();
          }

          let res = run(function* generator(resume) {
            let correct_setup_res = yield execute(
              correct_worker,
              sql_editor.setup_query,
              resume
            );
            let correct_query_res = yield execute(
              correct_worker,
              sql_editor.correct_query,
              resume
            );
            let student_setup_res = yield execute(
              student_result_worker,
              sql_editor.setup_query,
              resume
            );
            let student_query_res = yield execute(
              student_result_worker,
              current_query,
              resume
            );
            console.log(correct_query_res);
            console.log(correct_setup_res);
            console.log(student_setup_res);
            console.log(student_query_res);
            let result;
            if (student_query_res.error) {
              result = false;
            } else {
              console.log("comparing");
              result =
                JSON.stringify(correct_query_res) ===
                JSON.stringify(student_query_res);
              // see https://stackoverflow.com/a/1144249
            }
            console.log("result", result);
          });
          console.log("res", res);
          return new TBool(res);

          /*
          let correct_promise = execute(
            correct_worker,
            sql_editor.setup_query
          ).then(() =>
            execute(correct_worker, sql_editor.correct_query).then((res) => {
              if (res.error) {
                throw "Correct answer seems wrong";
              } else {
                return res.results;
              }
            })
          );

          let student_promise = execute(
            student_result_worker,
            sql_editor.setup_query
          ).then(() =>
            execute(student_result_worker, current_query).then((res) => {
              return res;
            })
          );

          let a = Promise.all([correct_promise, student_promise]).then(
            ([correct_set, student_set]) => {
              if (student_set.error) {
                return false;
              } else {
                return correct_set == student_set.results;
              }
            }
          );
          return a.then((r) => new TBool(r));*/
        },
      },
      { unwrapValues: true }
    )
  );
});
