from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import MONGODB_URL, MONGODB_DB_NAME, WMS_DB_NAME

class DBConnector:
    _client = None
    _ai_db = None
    _wms_db = None
    
    @classmethod
    async def get_client(cls):
        if cls._client is None:
            cls._client = AsyncIOMotorClient(MONGODB_URL)
        return cls._client
    
    @classmethod
    async def get_ai_db(cls):
        if cls._ai_db is None:
            client = await cls.get_client()
            cls._ai_db = client[MONGODB_DB_NAME]
        return cls._ai_db
    
    @classmethod
    async def get_wms_db(cls):
        if cls._wms_db is None:
            client = await cls.get_client()
            cls._wms_db = client[WMS_DB_NAME]
        return cls._wms_db
    
    @classmethod
    async def get_users(cls, role=None, limit=100):
        db = await cls.get_wms_db()
        query = {}
        if role:
            query['role'] = role
        cursor = db.users.find(query).limit(limit)
        return await cursor.to_list(length=limit)
    
    @classmethod
    async def get_user_by_id(cls, user_id):
        from bson import ObjectId
        db = await cls.get_wms_db()
        return await db.users.find_one({'_id': ObjectId(user_id)})
    
    @classmethod
    async def get_vehicles(cls, status=None, limit=100):
        db = await cls.get_wms_db()
        query = {}
        if status:
            query['status'] = status
        cursor = db.vehicles.find(query).sort('createdAt', -1).limit(limit)
        return await cursor.to_list(length=limit)
    
    @classmethod
    async def get_transactions(cls, customer_id=None, type_filter=None, limit=200):
        from bson import ObjectId
        db = await cls.get_wms_db()
        query = {}
        if customer_id:
            query['customer'] = ObjectId(customer_id)
        if type_filter:
            query['type'] = type_filter
        cursor = db.transactions.find(query).sort('createdAt', -1).limit(limit)
        return await cursor.to_list(length=limit)
    
    @classmethod
    async def get_loans(cls, customer_id=None, status=None, limit=100):
        from bson import ObjectId
        db = await cls.get_wms_db()
        query = {}
        if customer_id:
            query['customer'] = ObjectId(customer_id)
        if status:
            query['status'] = status
        cursor = db.loans.find(query).sort('createdAt', -1).limit(limit)
        return await cursor.to_list(length=limit)
    
    @classmethod
    async def get_warehouse_layouts(cls, limit=10):
        db = await cls.get_wms_db()
        cursor = db.dynamicwarehouselayouts.find({}).limit(limit)
        return await cursor.to_list(length=limit)
    
    @classmethod
    async def get_storage_allocations(cls, customer_id=None, limit=100):
        from bson import ObjectId
        db = await cls.get_wms_db()
        query = {}
        if customer_id:
            query['customer'] = ObjectId(customer_id)
        cursor = db.storageallocations.find(query).limit(limit)
        return await cursor.to_list(length=limit)
    
    @classmethod
    async def get_requests(cls, status=None, limit=50):
        db = await cls.get_wms_db()
        query = {}
        if status:
            query['status'] = status
        cursor = db.requests.find(query).sort('createdAt', -1).limit(limit)
        return await cursor.to_list(length=limit)
    
    @classmethod
    async def get_market_prices(cls):
        """Get live market prices from external source or cache."""
        db = await cls.get_ai_db()
        prices = await db.market_prices.find_one({'type': 'latest'})
        if prices:
            return prices.get('prices', {})
        # Default fallback prices
        return {
            'rice': {'price': 2200, 'unit': 'quintal', 'trend': 'stable'},
            'wheat': {'price': 2400, 'unit': 'quintal', 'trend': 'up'},
            'maize': {'price': 1800, 'unit': 'quintal', 'trend': 'down'},
            'jowar': {'price': 2800, 'unit': 'quintal', 'trend': 'up'},
            'bajra': {'price': 2100, 'unit': 'quintal', 'trend': 'stable'},
            'cotton': {'price': 6500, 'unit': 'quintal', 'trend': 'up'},
            'soybean': {'price': 4200, 'unit': 'quintal', 'trend': 'down'},
            'groundnut': {'price': 5500, 'unit': 'quintal', 'trend': 'stable'}
        }
    
    @classmethod
    async def save_market_prices(cls, prices):
        db = await cls.get_ai_db()
        await db.market_prices.update_one(
            {'type': 'latest'},
            {'$set': {'type': 'latest', 'prices': prices, 'updated_at': __import__('datetime').datetime.utcnow()}},
            upsert=True
        )
    
    @classmethod
    async def get_warehouse_summary(cls):
        """Get comprehensive warehouse layout summary with filled/empty block details."""
        db = await cls.get_wms_db()
        layouts = await db.dynamicwarehouselayouts.find({}).to_list(length=10)
        
        if not layouts:
            return {'warehouses': [], 'total_warehouses': 0}
        
        warehouses = []
        for layout in layouts:
            wh = {
                'name': layout.get('name', 'Unknown'),
                'total_slots': layout.get('totalSlots', 0),
                'occupied_slots': layout.get('occupiedSlots', 0),
                'empty_slots': layout.get('totalSlots', 0) - layout.get('occupiedSlots', 0),
                'is_active': layout.get('isActive', True),
                'pricing': layout.get('pricing', {}),
                'buildings': []
            }
            
            config = layout.get('configuration', {})
            wh['configuration'] = {
                'buildings': config.get('numberOfBuildings', 0),
                'blocks_per_building': config.get('blocksPerBuilding', 0),
                'rows_per_block': config.get('rowsPerBlock', 0),
                'cols_per_block': config.get('colsPerBlock', 0)
            }
            
            # Parse building/block/slot details
            for building_data in layout.get('layout', []):
                building_info = {
                    'name': building_data.get('building', ''),
                    'blocks': []
                }
                for block_data in building_data.get('blocks', []):
                    block_label = block_data.get('block', '')
                    slots = block_data.get('slots', [])
                    
                    empty_count = sum(1 for s in slots if s.get('status') == 'empty')
                    partial_count = sum(1 for s in slots if s.get('status') == 'partially-filled')
                    full_count = sum(1 for s in slots if s.get('status') == 'full')
                    total_bags = sum(s.get('filledBags', 0) for s in slots)
                    total_capacity = sum(s.get('capacity', 1500) for s in slots)
                    
                    # Collect customer allocations in this block
                    customers_in_block = set()
                    for s in slots:
                        for alloc in s.get('allocations', []):
                            cname = alloc.get('customerName', 'Unknown')
                            customers_in_block.add(cname)
                    
                    block_info = {
                        'label': block_label,
                        'total_slots': len(slots),
                        'empty_slots': empty_count,
                        'partially_filled_slots': partial_count,
                        'full_slots': full_count,
                        'total_bags': total_bags,
                        'total_capacity': total_capacity,
                        'customers': list(customers_in_block)
                    }
                    building_info['blocks'].append(block_info)
                
                wh['buildings'].append(building_info)
            
            warehouses.append(wh)
        
        return {
            'warehouses': warehouses,
            'total_warehouses': len(warehouses)
        }
    
    @classmethod
    async def get_analytics_summary(cls):
        """Get comprehensive analytics data from WMS database."""
        db = await cls.get_wms_db()
        
        total_customers = await db.users.count_documents({'role': 'customer'})
        total_vehicles = await db.vehicles.count_documents({})
        active_loans = await db.loans.count_documents({'status': 'active'})
        pending_loans = await db.loans.count_documents({'status': 'pending'})
        
        # Revenue calculation
        pipeline = [
            {'$match': {'payment.status': 'completed'}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount.totalAmount'}}}
        ]
        revenue_result = await db.transactions.aggregate(pipeline).to_list(1)
        total_revenue = revenue_result[0]['total'] if revenue_result else 0
        
        return {
            'total_customers': total_customers,
            'total_vehicles': total_vehicles,
            'active_loans': active_loans,
            'pending_loans': pending_loans,
            'total_revenue': total_revenue
        }
