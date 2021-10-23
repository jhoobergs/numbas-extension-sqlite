Numbas.addExtension("sqlite", ["jme", "jme-display"], function (extension) {
  let scope = extension.scope;

  // write your extension code here

  let jme = Numbas.jme;
  let sig = jme.signature;
  let delay = 10;

  let types = jme.types;
  let funcObj = jme.funcObj;
  let TString = types.TString;
  let TBool = types.TBool;
  let TList = types.TList;
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
    this.student_worker = null; // ??
    this.el = null; // ??
    this.correct_result = null;
    this.current_result = null;
    this.show_expected_columns = null;
    this.value = data;
    this.promise = data.promise; // ??
    this.container = data.element;

    this.promise.then(function ([el, student_worker, correct_result]) {
      a.student_worker = student_worker;
      a.element = el;
      a.correct_result = correct_result;
    });
  };
  jme.registerType(TSQLEditor, "sqleditor", {
    html: function (v) {
      return new jme.types.THTML(v.container);
    },
  });

  jme.display.registerType(TSQLEditor, {
    tex: function (v) {
      return "\\text{SQLite applet}";
    },
    jme: function (v) {
      let data = v.tok.value;
      let f = new jme.types.TFunc("sqlite_editor");
      let tree = {
        tok: f,
        args: [
          { tok: jme.wrapValue(data.setup_query) },
          { tok: jme.wrapValue(data.correct_query) },
          { tok: jme.wrapValue(data.show_expected_columns) },
        ],
      };

      let jme_s = jme.display.treeToJME(tree);
      return jme_s;
      /*if(v.tok._to_jme) {
                    throw(new Numbas.Error("A GeoGebra applet refers to itself in its own definition."));
                }
                v.tok._to_jme = true;
                var data = v.tok.value.suspendData();
                var options = jme.wrapValue(data.options);
                var replacements = jme.wrapValue(data.replacements);
                var parts = jme.wrapValue(data.parts);
                var base64 = jme.wrapValue(data.base64);
                var cache = {};
                Object.keys(v.tok.cache).forEach(function(section) {
                    cache[section] = new TDict(v.tok.cache[section]);
                });
                var f = new jme.types.TFunc('resume_geogebra_applet');
                var tree = {
                    tok: f,
                    args: [
                        {tok: options},
                        {tok: replacements},
                        {tok: parts},
                        {tok: base64},
                        {tok: new TDict(cache)}
                    ]
                };
                var s = jme.display.treeToJME(tree);
                v.tok._to_jme = false;
      return s; */
    },
    displayString: function (v) {
      return "SQLite applet";
    },
  });
  let worker = () => {
    return new Worker(
      //"https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.1/worker.sql-wasm.js"
      "extensions/sqlite/standalone_scripts/worker.sql-wasm.js"
    );
  };

  // Run a command in the database
  function execute(worker, commands) {
    return new Promise((resolve, reject) => {
      worker.onmessage = (event) => resolve(event.data);
      worker.onerror = (event) => {
        reject(event);
      };
      worker.postMessage({ action: "exec", sql: commands });
    });
  }

  let injectedDeployScript = false;

  /** Load the CodeMirror code from a cdn.
   *
   * @returns {Promise} - resolves to the `CodeMirror` constructor.
   */
  var loadCodeMirror = new Promise(function (resolve, reject) {
    if (window.CodeMirror) {
      resolve(CodeMirror);
    } else {
      if (!injectedDeployScript) {
        var s = document.createElement("script");
        s.setAttribute("type", "text/javascript");
        s.setAttribute(
          "src",
          "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.58.1/codemirror.js"
        );
        document.head.appendChild(s);
        injectedDeployScript = true;
      }
      var int = setInterval(function () {
        if (window.CodeMirror) {
          clearInterval(int);
          resolve(CodeMirror);
        }
      }, delay);
    }
  });

  let injectedSQLMode = false;

  /** Load the CodeMirror sql code from a cdn.
   *
   * @returns {Promise} - resolves to the `CodeMirror` constructor.
   */
  var loadCodeMirrorSQL = (CodeMirror) =>
    new Promise(function (resolve, reject) {
      if (!injectedSQLMode) {
        var s = document.createElement("script");
        s.setAttribute("type", "text/javascript");
        s.setAttribute(
          "src",
          "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.58.1/mode/sql/sql.min.js"
        );
        document.body.appendChild(s);
        injectedSQLMode = true;
      }
      resolve();
    });

  // TODO
  /** Load
   *
   * @returns {Promise} - resolves to a sqlite `worker`.
   */
  let initializeDbWorker = (setup_query) => {
    let dbWorker = worker();
    return execute(dbWorker, "PRAGMA foreign_keys = ON;") // Enable foreign keys constraint checking
      .then(() =>
        execute(dbWorker, setup_query).then((result) => {
          if (!result.error) {
            return dbWorker;
          } else {
            console.log("Failing for ", setup_query);
            dbWorker.terminate();
            throw "Failed initializing a database.";
          }
        })
      );
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
  let showEditor = function (state) {
    return new Promise(function (resolve, reject) {
      let element = document.createElement("div");
      let textarea = document.createElement("textarea");
      textarea.setAttribute("style", "display:block;min-width:600;");
      let button = document.createElement("button");
      button.innerHTML = "Execute";
      button.setAttribute("class", "btn btn-primary");
      let result = document.createElement("div");
      result.setAttribute("style", "margin-top:10px;");
      let resetButton = document.createElement("button");
      resetButton.innerHTML = "Reset DB";
      resetButton.setAttribute("class", "btn btn-primary");

      let showTablesButton = document.createElement("button");
      showTablesButton.innerHTML = "Show Tables";
      showTablesButton.setAttribute("class", "btn btn-primary");

      let execEditorContents = () => {
        let command = editor.getValue();
        if (!command) {
          // If command is empty text
          result.innerHTML = "";
          return;
        }
        execute(state.student_worker, command).then((data) => {
          let results = data.results;
          state.current_result = data;
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
      };

      let showTablesInfo = async (command) => {
        let data = await execute(
          state.student_worker,
          "SELECT name FROM `sqlite_master` WHERE type='table';"
        );
        let results_sets = [];
        for (let name of data.results[0].values) {
          let command = "";
          command += `PRAGMA table_info('${name}');`;
          command += `PRAGMA foreign_key_list('${name}');`;
          let result = await execute(state.student_worker, command);
          results_sets.push([name, result]);
        }
        result.innerHTML = "";
        for (let [name, data] of results_sets) {
          let h = document.createElement("h4");
          h.innerHTML = name;
          result.appendChild(h);
          let results = data.results;
          if (!results) {
            let span = document.createElement("span");
            span.innerHTML = data.error;
            result.appendChild(span);
          } else {
            result.appendChild(
              tableCreate(results[0].columns, results[0].values)
            );
            if (results.length > 1) {
              let h = document.createElement("h4");
              h.innerHTML = `Foreign keys of ${name}`;
              result.appendChild(h);
              result.appendChild(
                tableCreate(results[1].columns, results[1].values)
              );
            }
          }
        }
      };

      button.addEventListener("click", (event) => {
        event.preventDefault();
        execEditorContents();
      });

      resetButton.addEventListener("click", (event) => {
        event.preventDefault();
        state.student_worker.terminate();
        initializeDbWorker(state.setup_query).then((w) => {
          state.student_worker = w;
          result.innerHTML = "Database has been reset";
        });
      });

      showTablesButton.addEventListener("click", (event) => {
        event.preventDefault();
        showTablesInfo();
      });

      if (state.show_expected_columns) {
        let div = document.createElement("div");
        let span = document.createElement("span");
        span.innerHTML = "Expected columns:";
        let table = tableCreate(state.correct_result.results[0].columns, []);
        table.setAttribute("style", "margin-left:0");
        div.appendChild(span);
        div.appendChild(table);
        element.appendChild(div);
      }
      element.appendChild(textarea);
      element.appendChild(button);
      element.appendChild(resetButton);
      element.appendChild(showTablesButton);
      element.appendChild(result);

      container.appendChild(element);

      // Add syntax highlighting to the textarea
      let editor = CodeMirror.fromTextArea(textarea, {
        mode: "text/x-mysql",
        viewportMargin: Infinity,
        indentWithTabs: true,
        smartIndent: true,
        lineNumbers: true,
        matchBrackets: true,
        autofocus: true,
        extraKeys: {
          "Ctrl-Enter": execEditorContents,
        },
      });
      resolve(element);
    });
  };

  function SQLEditor(setup_query, correct_query, show_expected_columns) {
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
    this.show_expected_columns = show_expected_columns;

    promise = promise
      .then(function () {
        return loadCodeMirror.then(loadCodeMirrorSQL);
      })
      .then(function () {
        // There are limits to the maximum amount of allowed web workers. So don't spawn to many at the same time
        return initializeDbWorker(setup_query).then((worker) =>
          execute(worker, correct_query).then((correct_result) => {
            worker.terminate();
            return initializeDbWorker(setup_query).then((student_worker) => [
              correct_result,
              student_worker,
            ]);
          })
        );
      })
      .then(function ([correct_result, student_worker]) {
        sql_editor.correct_result = correct_result;
        sql_editor.student_worker = student_worker;
        return showEditor(sql_editor).then((el) => [
          el,
          student_worker,
          correct_result,
        ]);
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
      .then(function ([el, worker, correct]) {
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
    correct_query,
    show_expected_columns
  ) {
    return new SQLEditor(setup_query, correct_query, show_expected_columns);
  };

  let sig_sqlite_editor = sig.sequence(
    sig.type("string"),
    sig.type("string"),
    sig.optional(sig.type("boolean"))
  );

  extension.scope.addFunction(
    new funcObj(
      "sqlite_editor",
      [sig_sqlite_editor],
      TSQLEditor,
      null, // ??
      {
        evaluate: function (args, scope) {
          let match = sig_sqlite_editor(args);
          let setup_query = args[0].value;
          let correct_query = args[1].value;
          let show_expected_columns;
          if (match[2].missing) {
            show_expected_columns = false;
          } else {
            show_expected_columns = args[2].value;
          }
          return new TSQLEditor(
            createSQLEditor(setup_query, correct_query, show_expected_columns)
          );
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

          console.log(sql_editor.correct_result);
          console.log(sql_editor.current_result);

          return new TBool(
            JSON.stringify(sql_editor.correct_result) ==
              JSON.stringify(sql_editor.current_result)
          );
        },
      },
      { unwrapValues: true }
    )
  );
});
