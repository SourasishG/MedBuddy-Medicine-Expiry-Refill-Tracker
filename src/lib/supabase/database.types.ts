export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "access_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"care_profile_id": string | null,"created_at": string,"id": number,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"care_profile_id"?: string | null,"created_at"?: string,"id"?: never,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"care_profile_id"?: string | null,"created_at"?: string,"id"?: never,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_care_profile_id_fkey"
      columns: ["care_profile_id"]
isOneToOne: false
      referencedRelation: "care_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_events_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"care_access": {
                  Row: {
                    "care_profile_id": string,"created_at": string,"notify_due": boolean,"notify_expiry": boolean,"notify_missed": boolean,"role": Database["public"]['Enums']["care_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "care_profile_id": string,"created_at"?: string,"notify_due"?: boolean,"notify_expiry"?: boolean,"notify_missed"?: boolean,"role": Database["public"]['Enums']["care_role"],"user_id": string
                  }
                  Update: {
                    "care_profile_id"?: string,"created_at"?: string,"notify_due"?: boolean,"notify_expiry"?: boolean,"notify_missed"?: boolean,"role"?: Database["public"]['Enums']["care_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_access_care_profile_id_fkey"
      columns: ["care_profile_id"]
isOneToOne: false
      referencedRelation: "care_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_access_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"care_profiles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"linked_user_id": string | null,"missed_after_minutes": number,"name": string,"renudge_after_minutes": number,"snooze_minutes": number,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"linked_user_id"?: string | null,"missed_after_minutes"?: number,"name": string,"renudge_after_minutes"?: number,"snooze_minutes"?: number,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"linked_user_id"?: string | null,"missed_after_minutes"?: number,"name"?: string,"renudge_after_minutes"?: number,"snooze_minutes"?: number,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_profiles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_profiles_linked_user_id_fkey"
      columns: ["linked_user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "accepted_at": string,"document": Database["public"]['Enums']["consent_doc"],"id": string,"user_id": string,"version": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"document": Database["public"]['Enums']["consent_doc"],"id"?: string,"user_id"?: string,"version": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string,"document"?: Database["public"]['Enums']["consent_doc"],"id"?: string,"user_id"?: string,"version"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dose_events": {
                  Row: {
                    "amount": number,"as_needed": boolean,"care_profile_id": string,"client_request_id": string | null,"created_at": string,"id": string,"logged_at": string | null,"logged_by": string | null,"medicine_id": string,"note": string | null,"schedule_id": string | null,"schedule_time_id": string | null,"scheduled_for": string,"snoozed_until": string | null,"status": Database["public"]['Enums']["dose_status"],"stock_shortfall": number,"taken_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"as_needed"?: boolean,"care_profile_id": string,"client_request_id"?: string | null,"created_at"?: string,"id"?: string,"logged_at"?: string | null,"logged_by"?: string | null,"medicine_id": string,"note"?: string | null,"schedule_id"?: string | null,"schedule_time_id"?: string | null,"scheduled_for": string,"snoozed_until"?: string | null,"status"?: Database["public"]['Enums']["dose_status"],"stock_shortfall"?: number,"taken_at"?: string | null
                  }
                  Update: {
                    "amount"?: number,"as_needed"?: boolean,"care_profile_id"?: string,"client_request_id"?: string | null,"created_at"?: string,"id"?: string,"logged_at"?: string | null,"logged_by"?: string | null,"medicine_id"?: string,"note"?: string | null,"schedule_id"?: string | null,"schedule_time_id"?: string | null,"scheduled_for"?: string,"snoozed_until"?: string | null,"status"?: Database["public"]['Enums']["dose_status"],"stock_shortfall"?: number,"taken_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dose_events_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dose_events_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicine_supply"
      referencedColumns: ["medicine_id","care_profile_id"]
    },{
      foreignKeyName: "dose_events_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicines"
      referencedColumns: ["id","care_profile_id"]
    },{
      foreignKeyName: "dose_events_schedule_id_fkey"
      columns: ["schedule_id"]
isOneToOne: false
      referencedRelation: "schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dose_events_schedule_time_id_fkey"
      columns: ["schedule_time_id"]
isOneToOne: false
      referencedRelation: "schedule_times"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "batch_no": string | null,"care_profile_id": string,"created_at": string,"expiry_date": string,"id": string,"medicine_id": string,"opened_on": string | null,"purchased_on": string | null,"quantity_initial": number,"quantity_remaining": number,"status": Database["public"]['Enums']["stock_status"],"storage_location": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no"?: string | null,"care_profile_id": string,"created_at"?: string,"expiry_date": string,"id"?: string,"medicine_id": string,"opened_on"?: string | null,"purchased_on"?: string | null,"quantity_initial": number,"quantity_remaining"?: number,"status"?: Database["public"]['Enums']["stock_status"],"storage_location"?: string | null
                  }
                  Update: {
                    "batch_no"?: string | null,"care_profile_id"?: string,"created_at"?: string,"expiry_date"?: string,"id"?: string,"medicine_id"?: string,"opened_on"?: string | null,"purchased_on"?: string | null,"quantity_initial"?: number,"quantity_remaining"?: number,"status"?: Database["public"]['Enums']["stock_status"],"storage_location"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicine_supply"
      referencedColumns: ["medicine_id","care_profile_id"]
    },{
      foreignKeyName: "inventory_items_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicines"
      referencedColumns: ["id","care_profile_id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "accepted_by": string | null,"care_profile_id": string,"created_at": string,"expires_at": string,"id": string,"invited_by": string | null,"invitee_hint": string | null,"role": Database["public"]['Enums']["care_role"],"status": Database["public"]['Enums']["invite_status"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_by"?: string | null,"care_profile_id": string,"created_at"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"invitee_hint"?: string | null,"role": Database["public"]['Enums']["care_role"],"status"?: Database["public"]['Enums']["invite_status"],"token_hash": string
                  }
                  Update: {
                    "accepted_by"?: string | null,"care_profile_id"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"invitee_hint"?: string | null,"role"?: Database["public"]['Enums']["care_role"],"status"?: Database["public"]['Enums']["invite_status"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_care_profile_id_fkey"
      columns: ["care_profile_id"]
isOneToOne: false
      referencedRelation: "care_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"medicine_catalog": {
                  Row: {
                    "form": Database["public"]['Enums']["medicine_form"] | null,"id": string,"name": string,"source": string,"strength": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "form"?: Database["public"]['Enums']["medicine_form"] | null,"id"?: string,"name": string,"source": string,"strength"?: string | null
                  }
                  Update: {
                    "form"?: Database["public"]['Enums']["medicine_form"] | null,"id"?: string,"name"?: string,"source"?: string,"strength"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"medicines": {
                  Row: {
                    "archived_at": string | null,"care_profile_id": string,"catalog_id": string | null,"created_at": string,"form": Database["public"]['Enums']["medicine_form"],"id": string,"name": string,"notes": string | null,"purpose": string | null,"shelf_life_after_opening_days": number | null,"strength": string | null,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"care_profile_id": string,"catalog_id"?: string | null,"created_at"?: string,"form"?: Database["public"]['Enums']["medicine_form"],"id"?: string,"name": string,"notes"?: string | null,"purpose"?: string | null,"shelf_life_after_opening_days"?: number | null,"strength"?: string | null,"unit"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"care_profile_id"?: string,"catalog_id"?: string | null,"created_at"?: string,"form"?: Database["public"]['Enums']["medicine_form"],"id"?: string,"name"?: string,"notes"?: string | null,"purpose"?: string | null,"shelf_life_after_opening_days"?: number | null,"strength"?: string | null,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "medicines_care_profile_id_fkey"
      columns: ["care_profile_id"]
isOneToOne: false
      referencedRelation: "care_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medicines_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "medicine_catalog"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "attempts": number,"body": string,"care_profile_id": string | null,"created_at": string,"dedupe_key": string,"dose_event_id": string | null,"id": string,"inventory_item_id": string | null,"kind": Database["public"]['Enums']["notif_kind"],"last_error": string | null,"send_after": string,"sent_at": string | null,"status": Database["public"]['Enums']["notif_status"],"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body": string,"care_profile_id"?: string | null,"created_at"?: string,"dedupe_key": string,"dose_event_id"?: string | null,"id"?: string,"inventory_item_id"?: string | null,"kind": Database["public"]['Enums']["notif_kind"],"last_error"?: string | null,"send_after"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notif_status"],"title": string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"body"?: string,"care_profile_id"?: string | null,"created_at"?: string,"dedupe_key"?: string,"dose_event_id"?: string | null,"id"?: string,"inventory_item_id"?: string | null,"kind"?: Database["public"]['Enums']["notif_kind"],"last_error"?: string | null,"send_after"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["notif_status"],"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_care_profile_id_fkey"
      columns: ["care_profile_id"]
isOneToOne: false
      referencedRelation: "care_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_dose_event_id_fkey"
      columns: ["dose_event_id"]
isOneToOne: false
      referencedRelation: "dose_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_inventory_item_id_fkey"
      columns: ["inventory_item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_inventory_item_id_fkey"
      columns: ["inventory_item_id"]
isOneToOne: false
      referencedRelation: "inventory_status"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"hide_names_in_notifications": boolean,"id": string,"large_text": boolean,"phone": string | null,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"hide_names_in_notifications"?: boolean,"id": string,"large_text"?: boolean,"phone"?: string | null,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"hide_names_in_notifications"?: boolean,"id"?: string,"large_text"?: boolean,"phone"?: string | null,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth_key": string,"created_at": string,"endpoint": string,"failure_count": number,"id": string,"last_success_at": string | null,"p256dh": string,"platform": string | null,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_key": string,"created_at"?: string,"endpoint": string,"failure_count"?: number,"id"?: string,"last_success_at"?: string | null,"p256dh": string,"platform"?: string | null,"user_agent"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "auth_key"?: string,"created_at"?: string,"endpoint"?: string,"failure_count"?: number,"id"?: string,"last_success_at"?: string | null,"p256dh"?: string,"platform"?: string | null,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"schedule_times": {
                  Row: {
                    "care_profile_id": string,"dose_amount": number | null,"food": Database["public"]['Enums']["food_rule"],"id": string,"schedule_id": string,"time_of_day": string
                  }
                  ComputedFields: never
                  Insert: {
                    "care_profile_id": string,"dose_amount"?: number | null,"food"?: Database["public"]['Enums']["food_rule"],"id"?: string,"schedule_id": string,"time_of_day": string
                  }
                  Update: {
                    "care_profile_id"?: string,"dose_amount"?: number | null,"food"?: Database["public"]['Enums']["food_rule"],"id"?: string,"schedule_id"?: string,"time_of_day"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_times_schedule_id_care_profile_id_fkey"
      columns: ["schedule_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "schedules"
      referencedColumns: ["id","care_profile_id"]
    }
                  ]
                },"schedules": {
                  Row: {
                    "active": boolean,"care_profile_id": string,"created_at": string,"days_of_week": (number)[] | null,"dose_amount": number,"end_date": string | null,"frequency": Database["public"]['Enums']["frequency_type"],"id": string,"instructions": string | null,"interval_days": number | null,"medicine_id": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"care_profile_id": string,"created_at"?: string,"days_of_week"?: (number)[] | null,"dose_amount": number,"end_date"?: string | null,"frequency"?: Database["public"]['Enums']["frequency_type"],"id"?: string,"instructions"?: string | null,"interval_days"?: number | null,"medicine_id": string,"start_date": string
                  }
                  Update: {
                    "active"?: boolean,"care_profile_id"?: string,"created_at"?: string,"days_of_week"?: (number)[] | null,"dose_amount"?: number,"end_date"?: string | null,"frequency"?: Database["public"]['Enums']["frequency_type"],"id"?: string,"instructions"?: string | null,"interval_days"?: number | null,"medicine_id"?: string,"start_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedules_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicine_supply"
      referencedColumns: ["medicine_id","care_profile_id"]
    },{
      foreignKeyName: "schedules_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicines"
      referencedColumns: ["id","care_profile_id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"delta": number,"dose_event_id": string | null,"id": string,"inventory_item_id": string,"reason": Database["public"]['Enums']["stock_reason"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"delta": number,"dose_event_id"?: string | null,"id"?: string,"inventory_item_id": string,"reason": Database["public"]['Enums']["stock_reason"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"delta"?: number,"dose_event_id"?: string | null,"id"?: string,"inventory_item_id"?: string,"reason"?: Database["public"]['Enums']["stock_reason"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_dose_event_id_fkey"
      columns: ["dose_event_id"]
isOneToOne: false
      referencedRelation: "dose_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_inventory_item_id_fkey"
      columns: ["inventory_item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_inventory_item_id_fkey"
      columns: ["inventory_item_id"]
isOneToOne: false
      referencedRelation: "inventory_status"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "care_members": {
                  Row: {
                    "care_profile_id": string,"display_name": string,"role": Database["public"]['Enums']["care_role"],"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "care_access_care_profile_id_fkey"
      columns: ["care_profile_id"]
isOneToOne: false
      referencedRelation: "care_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_access_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_status": {
                  Row: {
                    "batch_no": string | null,"care_profile_id": string,"created_at": string,"days_left": number | null,"effective_expiry": string | null,"expiry_band": string | null,"expiry_date": string,"id": string,"medicine_id": string,"medicine_name": string,"opened_on": string | null,"purchased_on": string | null,"quantity_initial": number,"quantity_remaining": number,"status": Database["public"]['Enums']["stock_status"],"storage_location": string | null,"unit": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicine_supply"
      referencedColumns: ["medicine_id","care_profile_id"]
    },{
      foreignKeyName: "inventory_items_medicine_id_care_profile_id_fkey"
      columns: ["medicine_id","care_profile_id"]
isOneToOne: false
      referencedRelation: "medicines"
      referencedColumns: ["id","care_profile_id"]
    }
                  ]
                },"medicine_supply": {
                  Row: {
                    "care_profile_id": string,"daily_usage": number | null,"days_of_supply": number | null,"medicine_id": string,"remaining": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "medicines_care_profile_id_fkey"
      columns: ["care_profile_id"]
isOneToOne: false
      referencedRelation: "care_profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_deduct_stock":
{ Args: { "p_amount": number,"p_event": string,"p_medicine": string }; Returns: number
                           },
"can_edit":
{ Args: { "cp": string }; Returns: boolean
                           },
"can_view":
{ Args: { "cp": string }; Returns: boolean
                           },
"fn_accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"fn_adjust_stock":
{ Args: { "p_delta": number,"p_item": string }; Returns: undefined
                           },
"fn_create_care_profile":
{ Args: { "p_is_me"?: boolean,"p_name": string,"p_timezone"?: string }; Returns: string
                           },
"fn_create_invite":
{ Args: { "p_care_profile": string,"p_hint"?: string,"p_role": Database["public"]['Enums']["care_role"] }; Returns: string
                           },
"fn_delete_my_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fn_discard_item":
{ Args: { "p_item": string }; Returns: undefined
                           },
"fn_enqueue_due_notifications":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fn_enqueue_expiry_notifications":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fn_export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fn_generate_dose_events":
{ Args: { "p_horizon_days"?: number,"p_schedule"?: string }; Returns: number
                           },
"fn_log_as_needed":
{ Args: { "p_amount": number,"p_client_request_id"?: string,"p_medicine": string,"p_taken_at"?: string }; Returns: {
              "amount": number,
"as_needed": boolean,
"care_profile_id": string,
"client_request_id": string | null,
"created_at": string,
"id": string,
"logged_at": string | null,
"logged_by": string | null,
"medicine_id": string,
"note": string | null,
"schedule_id": string | null,
"schedule_time_id": string | null,
"scheduled_for": string,
"snoozed_until": string | null,
"status": Database["public"]['Enums']["dose_status"],
"stock_shortfall": number,
"taken_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "dose_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"fn_log_dose":
{ Args: { "p_client_request_id"?: string,"p_event": string,"p_status": Database["public"]['Enums']["dose_status"],"p_taken_at"?: string }; Returns: {
              "amount": number,
"as_needed": boolean,
"care_profile_id": string,
"client_request_id": string | null,
"created_at": string,
"id": string,
"logged_at": string | null,
"logged_by": string | null,
"medicine_id": string,
"note": string | null,
"schedule_id": string | null,
"schedule_time_id": string | null,
"scheduled_for": string,
"snoozed_until": string | null,
"status": Database["public"]['Enums']["dose_status"],
"stock_shortfall": number,
"taken_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "dose_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"fn_remove_access":
{ Args: { "p_care_profile": string,"p_user": string }; Returns: undefined
                           },
"fn_resync_schedule":
{ Args: { "p_schedule": string }; Returns: number
                           },
"fn_revoke_invite":
{ Args: { "p_invite": string }; Returns: undefined
                           },
"fn_set_my_notifications":
{ Args: { "p_care_profile": string,"p_due": boolean,"p_expiry": boolean,"p_missed": boolean }; Returns: undefined
                           },
"fn_set_role":
{ Args: { "p_care_profile": string,"p_role": Database["public"]['Enums']["care_role"],"p_user": string }; Returns: undefined
                           },
"fn_snooze_dose":
{ Args: { "p_event": string,"p_minutes"?: number }; Returns: {
              "amount": number,
"as_needed": boolean,
"care_profile_id": string,
"client_request_id": string | null,
"created_at": string,
"id": string,
"logged_at": string | null,
"logged_by": string | null,
"medicine_id": string,
"note": string | null,
"schedule_id": string | null,
"schedule_time_id": string | null,
"scheduled_for": string,
"snoozed_until": string | null,
"status": Database["public"]['Enums']["dose_status"],
"stock_shortfall": number,
"taken_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "dose_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"fn_undo_dose":
{ Args: { "p_event": string }; Returns: {
              "amount": number,
"as_needed": boolean,
"care_profile_id": string,
"client_request_id": string | null,
"created_at": string,
"id": string,
"logged_at": string | null,
"logged_by": string | null,
"medicine_id": string,
"note": string | null,
"schedule_id": string | null,
"schedule_time_id": string | null,
"scheduled_for": string,
"snoozed_until": string | null,
"status": Database["public"]['Enums']["dose_status"],
"stock_shortfall": number,
"taken_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "dose_events"
        isOneToOne: true
        isSetofReturn: false
      } },
"is_owner":
{ Args: { "cp": string }; Returns: boolean
                           },
"is_valid_tz":
{ Args: { "tz": string }; Returns: boolean
                           }
          }
          Enums: {
            "care_role": "owner"|"caregiver"|"viewer","consent_doc": "terms"|"privacy"|"health_data","dose_status": "pending"|"taken"|"skipped"|"missed","food_rule": "any"|"before_food"|"with_food"|"after_food","frequency_type": "daily"|"weekdays"|"interval"|"as_needed","invite_status": "pending"|"accepted"|"revoked"|"expired","medicine_form": "tablet"|"capsule"|"syrup"|"drops"|"ointment"|"injection"|"inhaler"|"patch"|"other","notif_kind": "dose_due"|"dose_renudge"|"dose_missed"|"expiry"|"low_stock","notif_status": "pending"|"sent"|"failed"|"cancelled","stock_reason": "dose_taken"|"dose_undone"|"manual_adjust"|"discarded","stock_status": "active"|"finished"|"discarded"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "care_role": ["owner", "caregiver", "viewer"],"consent_doc": ["terms", "privacy", "health_data"],"dose_status": ["pending", "taken", "skipped", "missed"],"food_rule": ["any", "before_food", "with_food", "after_food"],"frequency_type": ["daily", "weekdays", "interval", "as_needed"],"invite_status": ["pending", "accepted", "revoked", "expired"],"medicine_form": ["tablet", "capsule", "syrup", "drops", "ointment", "injection", "inhaler", "patch", "other"],"notif_kind": ["dose_due", "dose_renudge", "dose_missed", "expiry", "low_stock"],"notif_status": ["pending", "sent", "failed", "cancelled"],"stock_reason": ["dose_taken", "dose_undone", "manual_adjust", "discarded"],"stock_status": ["active", "finished", "discarded"]
          }
        }
} as const
