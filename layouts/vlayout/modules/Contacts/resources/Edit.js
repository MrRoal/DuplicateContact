/*+***********************************************************************************
 * The contents of this file are subject to the vtiger CRM Public License Version 1.0
 * ("License"); You may not use this file except in compliance with the License
 * The Original Code is:  vtiger CRM Open Source
 * The Initial Developer of the Original Code is vtiger.
 * Portions created by vtiger are Copyright (C) vtiger.
 * All Rights Reserved.
 *************************************************************************************/
Vtiger_Edit_Js("Contacts_Edit_Js",{},{
	
	//Stored history of Contact Email and duplicate check result
	duplicateCheckCache : {}, // Milan Malani 16022017 - Check duplicate Contact with Email Address

	//Will have the mapping of address fields based on the modules
	addressFieldsMapping : {'Accounts' :
									{'mailingstreet' : 'bill_street',  
									'otherstreet' : 'ship_street', 
									'mailingpobox' : 'bill_pobox',
									'otherpobox' : 'ship_pobox',
									'mailingcity' : 'bill_city',
									'othercity' : 'ship_city',
									'mailingstate' : 'bill_state',
									'otherstate' : 'ship_state',
									'mailingzip' : 'bill_code',
									'otherzip' : 'ship_code',
									'mailingcountry' : 'bill_country',
									'othercountry' : 'ship_country'
									}
							},
							
	//Address field mapping within module
	addressFieldsMappingInModule : {
										'otherstreet' : 'mailingstreet',
										'otherpobox' : 'mailingpobox',
										'othercity' : 'mailingcity',
										'otherstate' : 'mailingstate',
										'otherzip' : 'mailingzip',
										'othercountry' : 'mailingcountry'
								},
	
	
	/**
	 * Function which will register event for Reference Fields Selection
	 */
	registerReferenceSelectionEvent : function(container) {
		var thisInstance = this;
		
		jQuery('input[name="account_id"]', container).on(Vtiger_Edit_Js.referenceSelectionEvent, function(e, data){
			thisInstance.referenceSelectionEventHandler(data, container);
		});
	},
	
	/**
	 * Reference Fields Selection Event Handler
	 * On Confirmation It will copy the address details
	 */
	referenceSelectionEventHandler :  function(data, container) {
		var thisInstance = this;
		var message = app.vtranslate('OVERWRITE_EXISTING_MSG1')+app.vtranslate('SINGLE_'+data['source_module'])+' ('+data['selectedName']+') '+app.vtranslate('OVERWRITE_EXISTING_MSG2');
		Vtiger_Helper_Js.showConfirmationBox({'message' : message}).then(
			function(e) {
				thisInstance.copyAddressDetails(data, container);
			},
			function(error, err){
			});
	},
	
	/**
	 * Function which will copy the address details - without Confirmation
	 */
	copyAddressDetails : function(data, container) {
		var thisInstance = this;
		var sourceModule = data['source_module'];
		thisInstance.getRecordDetails(data).then(
			function(data){
				var response = data['result'];
				thisInstance.mapAddressDetails(thisInstance.addressFieldsMapping[sourceModule], response['data'], container);
			},
			function(error, err){

			});
	},
	
	/**
	 * Function which will map the address details of the selected record
	 */
	mapAddressDetails : function(addressDetails, result, container) {
		for(var key in addressDetails) {
            if(container.find('[name="'+key+'"]').length == 0) {
                var create = container.append("<input type='hidden' name='"+key+"'>");
            }
			
			if((key == 'mailingcountry' || result[addressDetails['mailingcountry']] != '')  && (key == 'othercountry' || result[addressDetails['othercountry']] != '')){
				container.find('[name="'+key+'"]').next().children('a').children('span').text(result[addressDetails[key]]);
			}
			container.find('[name="'+key+'"]').val(result[addressDetails[key]]);
			container.find('[name="'+key+'"]').trigger('change');
		}
	},
	
	/**
	 * Function to swap array
	 * @param Array that need to be swapped
	 */ 
	swapObject : function(objectToSwap){
		var swappedArray = {};
		var newKey,newValue;
		for(var key in objectToSwap){
			newKey = objectToSwap[key];
			newValue = key;
			swappedArray[newKey] = newValue;
		}
		return swappedArray;
	},
	
	/**
	 * Function to copy address between fields
	 * @param strings which accepts value as either odd or even
	 */
	copyAddress : function(swapMode, container){
		var thisInstance = this;
		var addressMapping = this.addressFieldsMappingInModule;
		if(swapMode == "false"){
			for(var key in addressMapping) {
				var fromElement = container.find('[name="'+key+'"]');
				var toElement = container.find('[name="'+addressMapping[key]+'"]');
				toElement.val(fromElement.val());
			}
		} else if(swapMode){
			var swappedArray = thisInstance.swapObject(addressMapping);
			for(var key in swappedArray) {
				var fromElement = container.find('[name="'+key+'"]');
				var toElement = container.find('[name="'+swappedArray[key]+'"]');
				toElement.val(fromElement.val());
			}
		}
	},
	
	/**
	 * Function to register event for copying address between two fileds
	 */
	registerEventForCopyingAddress : function(container){
		var thisInstance = this;
		var swapMode;
		jQuery('[name="copyAddress"]').on('click',function(e){
			var element = jQuery(e.currentTarget);
			var target = element.data('target');
			if(target == "other"){
				swapMode = "false";
			} else if(target == "mailing"){
				swapMode = "true";
			}
			thisInstance.copyAddress(swapMode, container);
		})
	},

    /**
	 * Function to check for Portal User
	 */
	checkForPortalUser : function(form){
		var element = jQuery('[name="portal"]',form);
		var response = element.is(':checked');
	        var primaryEmailField = jQuery('[name="email"]',form);
		var primaryEmailValue = primaryEmailField.val();
		if(response){
			if(primaryEmailField.length == 0){
				Vtiger_Helper_Js.showPnotify(app.vtranslate('JS_PRIMARY_EMAIL_FIELD_DOES_NOT_EXISTS'));
				return false;
			}
			if(primaryEmailValue == ""){
				Vtiger_Helper_Js.showPnotify(app.vtranslate('JS_PLEASE_ENTER_PRIMARY_EMAIL_VALUE_TO_ENABLE_PORTAL_USER'));
				return false;
			}
		}
		return true;
	},

	//Start - Milan Malani 16022017 - Check duplicate Contact with Email Address
	/**
	 * Function to find Duplicate Contact Based on Primary Email Address
	 */
	checkDuplicateName : function(details) {
		var email = details.email;
		var recordId = details.recordId;
		var aDeferred = jQuery.Deferred();
		var moduleName = details.moduleName;
		if(typeof moduleName == "undefined"){
			moduleName = app.getModuleName();
		}
		var params = {
			'module' : moduleName,
			'action' : "CheckDuplicate",
			'email' : email,
			'record' : recordId
		}
		AppConnector.request(params).then(
			function(data) {
				var response = data['result'];
				var result = response['success'];
				if(result == true) {
					aDeferred.reject(response);
				} else {
					aDeferred.resolve(response);
				}
			},
			function(error,err){
				aDeferred.reject();
			}
		);
		return aDeferred.promise();
	},

	/**
	 * Function to register recordpresave event
	 */
	registerRecordPreSaveEvent : function(form){
		var thisInstance = this;
		if(typeof form == 'undefined') {
			form = this.getForm();
		}

		form.on(Vtiger_Edit_Js.recordPreSave, function(e, data) {
			var email = jQuery('input[name="email"]',form).val();
			var recordId = jQuery('input[name="record"]',form).val();
			var result = thisInstance.checkForPortalUser(form);
			if(!result){
				e.preventDefault();
			}
			if(email != ''){
	            if(!(email in thisInstance.duplicateCheckCache)) {
	                thisInstance.checkDuplicateName({
	                    'email' : email, 
	                    'recordId' : recordId,
	                    'moduleName' : 'Contacts'
	                }).then(
	                    function(data){
	                        thisInstance.duplicateCheckCache[email] = data['success'];
	                        form.submit();
	                    },
	                    function(data, err){
	                        thisInstance.duplicateCheckCache[email] = data['success'];
	                        thisInstance.duplicateCheckCache['message'] = data['message'];
							var message = app.vtranslate('JS_DUPLICTAE_CREATION_CONFIRMATION');
							Vtiger_Helper_Js.showConfirmationBox({'message' : message}).then(
								function(e) {
									thisInstance.duplicateCheckCache[email] = false;
									form.submit();
								},
								function(error, err) {
									
								}
							);
	                    }
					);
	            } else {
					if(thisInstance.duplicateCheckCache[email] == true){
						var message = app.vtranslate('JS_DUPLICTAE_CREATION_CONFIRMATION');
						Vtiger_Helper_Js.showConfirmationBox({'message' : message}).then(
							function(e) {
								thisInstance.duplicateCheckCache[email] = false;
								form.submit();
							},
							function(error, err) {
								
							}
						);
					} else {
						delete thisInstance.duplicateCheckCache[email];
						return true;
					}
				}
			} else {
				return true;
			}
            e.preventDefault();
		})
	},
	//End - Milan Malani 16022017 - Check duplicate Contact with Email Address
	
	registerBasicEvents : function(container){
		this._super(container);
		this.registerReferenceSelectionEvent(container);
		this.registerEventForCopyingAddress(container);
		this.registerRecordPreSaveEvent(container);
	}
})


jQuery(document).ready(function(){
	/*jQuery('input[name=firstname]').focus();
	jQuery('input[name=firstname]').attr("tabindex", 0);
	jQuery('input[name=lastname]').attr("tabindex", 1);
	jQuery('input[name=account_id_display]').attr("tabindex", 2);
	jQuery('input[name=cf_896]').attr("tabindex", 3);
	jQuery('input[name=title]').attr("tabindex", 4);
	jQuery('input[name=department]').attr("tabindex", 5);
	jQuery('input[name=leadsource]').attr("tabindex", 6);
	jQuery('input[name=cf_760]').attr("tabindex", 7);
	jQuery('input[name=assigned_user_id]').attr("tabindex", 8);
	jQuery('input[name=cf_1127]').attr("tabindex", 9);
	jQuery('input[name=mobile]').attr("tabindex", 10);
	jQuery('input[name=otherphone]').attr("tabindex", 11);
	jQuery('input[name=email]').attr("tabindex", 12);
	jQuery('input[name=secondaryemail]').attr("tabindex", 13);
	jQuery('input[name=emailoptout]').attr("tabindex", 14);
	jQuery('input[name=fax]').attr("tabindex", 15);
	
	jQuery('textarea[name=mailingstreet]').attr("tabindex", 16);
	jQuery('input[name=mailingpobox]').attr("tabindex", 17);
	jQuery('input[name=mailingcity]').attr("tabindex", 18);
	jQuery('input[name=mailingstate]').attr("tabindex", 19);
	jQuery('input[name=mailingzip]').attr("tabindex", 20);
	jQuery('input[name=mailingcountry]').attr("tabindex", 21);
		
	jQuery('textarea[name=otherstreet]').attr("tabindex", 22);
	jQuery('input[name=otherpobox]').attr("tabindex", 23);
	jQuery('input[name=othercity]').attr("tabindex", 24);
	jQuery('input[name=otherstate]').attr("tabindex", 25);
	jQuery('input[name=otherzip]').attr("tabindex", 26);
	jQuery('input[name=othercountry]').attr("tabindex", 27);*/
})