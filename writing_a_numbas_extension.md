# Writing a Numbas extension

In this post I will go through my development process for a Numbas extension named `sqlite`.
The goal of the extension is to create exercises to evaluate students understanding of SQL. All database related stuff will be handled by `sql.js`.

## The extension

The extension will add a function to create a SQLEditor where students can type SQL queries and experiment with the database. This function will take the following arguments: the sql code to create the initial state of the db, the sql code to yield to wanted state, and the type of evaluation.

The creator of the question can should between several types of evaluation:

- Evaluate whether the given query yields the right resultset when executed on the initial database
  - This is mainly useful for `SELECT` queries where they should not change the db state.
- Evaluate whether the student manipulated the database in the right way so the current state of the database equals the wanted state.
  - This is mainly useful for `INSERT`, `UPDATE`, `DELETE` and `DROP` queries

When a student thinks that they have found the solution, they can submit and Numbas will tell them whether they were right or wrong.

## Starting with the extension

I had never written a Numbas extension before, so I started by visiting https://numbas-editor.readthedocs.io/en/latest/extensions/index.html where I found the basic syntax to start developing my extension:

```
Numbas.addExtension("sqlite", ["jme"], function (extension) {
}
```

There was also some information about adding JME functions and data types.

After looking at this, I didn't really knew were to start. I did, however, know that there was a geogebra extension that had some similar needs. So I checked out some questions that used the geogebra extension by looking through the projects of Christian Lawson-Perfect and found the following question: https://numbas.mathcentre.ac.uk/question/68262/mark-a-part-as-correct-if-the-student-moves-a-point-to-the-right-position/

In this question, a student needs do drag a point to the right place and click on `submit` when they think they moved it to the right place. This is quite similar to needing to write or execute the right `SQL` queries and clicking on `submit` when they think they wrote or executed the right queries. When I took a look at the design of the question I saw the following things:

- The question has one part and that part has type `extension`.
  - I was somehow thinking about using a jme part type and had completely forgotten about the extension part type
- The content of the part was just a variable
  - This variable had a value of the form `geogebra_applet(....)`
  - This made me want to create a function of the form `sql_editor(...)`
- In the marking script, a custom marking script that extended the base marking algorithm was used
  - A `value` function was created to calculate the position of the point.
  - The `mark` note was `correctif(pos=target_position)`
  - They set the `interpreted_answer` to the result of the value call.

## How will the extension be used

- Users will need to add a part with type `extension`
- They will need to create a variable (e.g. `editor`) for the sql_editor with jme value `sql_editor(<sql_code_for_initial_state>, <wanted sql string>)`
- Within the statement they will need to make sure that they show this variable (e.g. `editor`)
- They can use functions to check
  - whether the resultset is correct `check_resultset(editor)`
  - whether the state is correct `check_state(editor)`
  - the current query `current_query(editor)`
  - all executed queries `complete_query(editor)`
- They will need to extend the base marking algorithm with something like

```
mark: correctif(check_resulset(editor))

interpreted_answer: current_query(editor)
```

or

```
mark: correctif(check_state(editor))

interpreted_answer: current_query(editor)
```
