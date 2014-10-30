# Sparql-Query-Tester

The Sparql-Query-Tester (or short SQT) is an easy configurable tool which allows
users to run a list of SPARQL Queries on an endpoint and test the results within Browsers.

It shows you the results and timings for your tests. You are also able

You are able to test it right now and upload an configuration file here:
[leipert.github.io/sqt](http://leipert.github.io/sqt)

## Configuration

The SQT can be easily configured with a yaml file. A valid config contains of two parts; a config object and an array of test objects.
You can find an working example below or [here](tests.yml).

The config object contains the app defaults (each test can overwrite the default settings)
- `url`: **String** *mandatory*. Default endpoint URL for all tests.
- `graph`: **String|Array**. Default graph(s) for all tests, defaults to ''
- `timeout`: **Integer**. Default timeout for all tests, defaults to 5000
- `prefixes`: **Object**. Prefined prefixes are rdfs, rdf, owl, xsd and wsg84. You can extend them with your own prefixes which you may use in your queries and will be used in the results.
 
The tests array contains test objects which contain the following properties:
- `title`: **String**. Name of the test
- `query`: **String** *mandatory*. Query which will be run on the defined endpoint.
- `config`: **Object**. An config object like described above, which overwrites the default configs.
- `expect`: **Array**. Array of strings and objects of tests which should be executed. Available tests are described below.
  - `isNotEmpty`: **String** Whether the result is not empty.
  - `isEmpty`: **String** Whether the result is empty.
  - `contains`: **Object** Whether the result contains a given object.
  - `containsNot`: **Object** Whether the result does not contain a given object.

A minimal example which uses all described config values would be:
```yaml
# The config part. You can define a default config for the tests
config:
  url: //ssl.leipert.io/sparql   # mandatory
  graph: http://gsb.leipert.io/ns/
  timeout: 1000
  prefixes:
    gsb: http://gsb.leipert.io/ns/
    foaf: http://xmlns.com/foaf/0.1/

# All tests are defined below
tests:
- title: Query with no tests.
  query: Select ?s ?p ?o { ?s ?p ?o } LIMIT 10 # mandatory
- title: Example with all tests
  query: | # Multiline Query example
     Select ?s ?p ?o {
       gsb:Agent rdfs:isDefinedBy ?s .
     } LIMIT 10
  expect:
     - isNotEmpty # whether a query returns results
     - contains : # whether a query contains a given object
          s: <http://gsb.leipert.io/ns/>
     - containsNot : # whether a query doesn't contain a given object
          s: <http://example.org/nonExistent>
- title: Overwritten config.
  query: Select ?s ?p ?o { ?s a foaf:nonExistent } LIMIT 10
  expect:
     - isEmpty # whether a query returns no results
  config: # You can overwrite each part of the default config
     url: http://dbpedia.org/sparql
     graph: http://dbpedia.org
     timeout: 10000
     prefixes:
       foaf: http://xmlns.com/foaf/0.1/
```
