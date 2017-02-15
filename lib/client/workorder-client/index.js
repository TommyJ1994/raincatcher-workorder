var q = require('q');
var _ = require('lodash');
var shortid = require('shortid');
var CONSTANTS = require('../../constants');
var config = require('../../config');
var topicGenerators = require('../../topic-generators');
var mediator, manager;

/**
 *
 * Getting Promises for done and error topics.
 *
 * @param doneTopicPromise  - A promise for the done topic.
 * @param errorTopicPromise - A promise for the error topic.
 * @returns {*}
 */
function getTopicPromises(doneTopicPromise, errorTopicPromise) {
  var deferred = q.defer();

  doneTopicPromise.then(function(createdWorkorder) {
    deferred.resolve(createdWorkorder);
  });

  errorTopicPromise.then(function(error) {
    deferred.reject(error);
  });

  return deferred.promise;
}


/**
 *
 * Creating a new workorder.
 *
 * @param {object} workorderToCreate - The Workorder to create.
 */
function create(workorderToCreate) {

  //Creating a unique channel to get the response
  var topicUid = shortid.generate();

  var topicParams = {topicUid: topicUid, itemToCreate: workorderToCreate};

  var donePromise = mediator.promise(topicGenerators.syncDoneTopic({topicUid: topicUid, topicName: CONSTANTS.TOPICS.CREATE}));

  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic({topicUid: topicUid, topicName: CONSTANTS.TOPICS.CREATE}));

  mediator.publish(topicGenerators.syncTopic({topicName: CONSTANTS.TOPICS.CREATE}), topicParams);

  return getTopicPromises(donePromise, errorPromise);
}

/**
 *
 * Updating an existing workorder.
 *
 * @param {object} workorderToUpdate - The workorder to update
 * @param {string} workorderToUpdate.id - The ID of the workorder to update
 */
function update(workorderToUpdate) {
  var topicParams = {topicUid: workorderToUpdate.id, itemToUpdate: workorderToUpdate};

  var donePromise = mediator.promise(topicGenerators.syncDoneTopic({topicUid: workorderToUpdate.id, topicName: CONSTANTS.TOPICS.UPDATE}));

  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic({topicUid: workorderToUpdate.id, topicName: CONSTANTS.TOPICS.UPDATE}));

  mediator.publish(topicGenerators.syncTopic({topicName: CONSTANTS.TOPICS.UPDATE}), topicParams);

  return getTopicPromises(donePromise, errorPromise);
}

/***
 *
 * Reading a single workorder.
 *
 * @param {string} workorderId - The ID of the workorder to read
 */
function read(workorderId) {

  var topicGenerationParams = {topicName: CONSTANTS.TOPICS.READ};

  var donePromise = mediator.promise(topicGenerators.syncDoneTopic({topicName: CONSTANTS.TOPICS.READ, topicUid: workorderId}));
  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic({topicName: CONSTANTS.TOPICS.READ, topicUid: workorderId}));

  mediator.publish(topicGenerators.syncTopic(topicGenerationParams), {id: workorderId, topicUid: workorderId});

  return getTopicPromises(donePromise, errorPromise);
}

/**
 * Listing All Workorders
 */
function list() {
  var topicParams = {topicName: CONSTANTS.TOPICS.LIST};

  var donePromise = mediator.promise(topicGenerators.syncDoneTopic(topicParams));
  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic(topicParams));

  mediator.publish(topicGenerators.syncTopic(topicParams));

  return getTopicPromises(donePromise, errorPromise);
}

/**
 *
 * Removing a workororder using the sync topics
 *
 * @param {object} workorderToRemove
 * @param {string} workorderToRemove.id - The ID of the workoroder to remove
 */
function remove(workorderToRemove) {

  var donePromise = mediator.promise(topicGenerators.syncDoneTopic({topicName: CONSTANTS.TOPICS.REMOVE, topicUid: workorderToRemove.id}));
  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic({topicName: CONSTANTS.TOPICS.REMOVE, topicUid: workorderToRemove.id}));

  mediator.publish(topicGenerators.syncTopic({topicName: CONSTANTS.TOPICS.REMOVE}), {id: workorderToRemove.id, topicUid: workorderToRemove.id});

  return getTopicPromises(donePromise, errorPromise);
}

/**
 * Starting the synchronisation process for workorders.
 */
function start() {

  var donePromise = mediator.promise(topicGenerators.syncDoneTopic({topicName: CONSTANTS.TOPICS.START}));
  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic({topicName: CONSTANTS.TOPICS.START}));

  mediator.publish(topicGenerators.syncTopic({topicName: CONSTANTS.TOPICS.START}));

  return getTopicPromises(donePromise, errorPromise);
}

/**
 * Stopping the synchronisation process for workorders.
 */
function stop() {
  var donePromise = mediator.promise(topicGenerators.syncDoneTopic({topicName: CONSTANTS.TOPICS.STOP}));
  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic({topicName: CONSTANTS.TOPICS.STOP}));

  mediator.publish(topicGenerators.syncTopic({topicName: CONSTANTS.TOPICS.STOP}));

  return getTopicPromises(donePromise, errorPromise);
}

/**
 * Forcing the workorders to sync to the remote store.
 */
function forceSync() {
  var donePromise = mediator.promise(topicGenerators.syncDoneTopic({topicName: CONSTANTS.TOPICS.FORCE_SYNC}));
  var errorPromise = mediator.promise(topicGenerators.syncErrorTopic({topicName: CONSTANTS.TOPICS.FORCE_SYNC}));

  mediator.publish(topicGenerators.syncTopic({topicName: CONSTANTS.TOPICS.FORCE_SYNC}));

  return getTopicPromises(donePromise, errorPromise);
}

/**
 * Safe stop forces a synchronisation to the remote server and then stops the synchronisation process.
 * @returns {Promise}
 */
function safeStop() {
  return forceSync().then(stop);
}


/**
 * Waiting for the synchronisation process to complete to the remote cluster.
 */
function waitForSync() {
  return mediator.promise(topicGenerators.syncTopic({topicName: "sync_complete"}));
}

function ManagerWrapper(_manager) {
  this.manager = _manager;
  var self = this;

  var methodNames = ['create', 'read', 'update', 'delete', 'list', 'start', 'stop', 'safeStop', 'forceSync', 'waitForSync'];
  methodNames.forEach(function(methodName) {
    self[methodName] = function() {
      return q.when(self.manager[methodName].apply(self.manager, arguments));
    };
  });
}


/**
 *
 * Initialising the workorder-client with a mediator.
 *
 * @param _mediator
 * @returns {ManagerWrapper|*}
 */
module.exports = function(_mediator) {

  //If there is already a manager, use this
  if (manager) {
    return manager;
  }

  mediator = _mediator;

  manager = new ManagerWrapper({
    create: create,
    update: update,
    list: list,
    delete: remove,
    start: start,
    stop: stop,
    read: read,
    safeStop: safeStop,
    forceSync: forceSync,
    publishRecordDeltaReceived: _.noop,
    waitForSync: waitForSync,
    datasetId: config.datasetId
  });

  return manager;
};