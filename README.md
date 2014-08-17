# Sparql-Query-Tester

The Sparql-Query-Tester (or short SQT) is a easy configurable tool which allows the user to run a list of SPARQL Queries on an endpoint (or diffenent ones) and test the results with the Browser.

You are able to test it right now and upload an configuration file here:
[http://leipert.github.io/sqt/]()

## Configuration

The SQT can be easily configured with a yaml file. All config parts optional, mandatory ones are marked.

A commented example would be:
```yaml
# The config part. You can define a default config for the tests
config:
  url: //ssl.leipert.io/sparql   # mandatory (URL of endpoint)
  graph: http://gsb.leipert.io/ns/ # Defaults to ''
  timeout: 1000 # Defaults to 5000
  prefixes: # Predefined prefixes are rdfs, rdf, owl, xsd and wsg84
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
     - isEmpty # whether a query returns no results
     - contains : # whether a query contains a given object
          s: <http://gsb.leipert.io/ns/>
     - containsNot : # whether a query doesn't contain a given object
          s: <http://example.org/nonExistent>
- title: Overwritten config.
  query: Select ?s ?p ?o { ?s ?p ?o } LIMIT 10
  expect:
     - isNotEmpty
  config: # You can overwrite each part of the default config
     url: http://dbpedia.org/sparql
     graph: http://dbpedia.org
     timeout: 10000
     prefixes:
       foaf: http://xmlns.com/foaf/0.1/
```
