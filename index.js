import MasterFox from 'master-fox-client';
import Table from 'console-table-printer';
import ellipsize from 'ellipsize';

// Our build of this library isn't quite compatible with all of the different JS stuff
import Models from 'master-fox-client/lib/resources/resources.js';

const {printTable} = Table;

const {Order, Area, GroupOrderMember, OrderItem} = Models;

const client = new MasterFox.default('https://api-staging.food.ee/', '8SMJ3XuneAsavFx7VTxujTeGY3oGtXKTHrm03HBz/W52z+SlctRwuUKUW8g=');

/**
 *  Creates an order item on the provided order/group order member for a given menu item
 * @param Order order
 * @param GroupOrderMember groupOrderMember
 * @param MenuItem menuItem
 * @return {Promise<void>}
 */
async function createOrderItem(order, groupOrderMember, menuItem) {
  console.log(`Adding order item to group order member ${groupOrderMember.id} on order: ${order.id}`)

  let orderItem = new OrderItem();
  orderItem.quantity = 1;
  orderItem.order = order;
  orderItem.groupOrderMember = groupOrderMember;
  orderItem.menuItem = menuItem;
  await client.orderItems.create(orderItem, {include: 'group-order-member,menu-item,order'});
}

/**
 * Create a GroupOrderMember, this would be a single ordered in the context of a shared order
 *
 * @param Order order
 * @return {Promise<T>}
 */
async function createGroupOrderMember(order) {
  console.log(`Adding group order member to order: ${order.id}`)

  let groupOrderMember = new GroupOrderMember();
  groupOrderMember.name = 'Joe Testing';
  groupOrderMember.email = 'joe.gaudet@food.ee';
  groupOrderMember.order = order;

  return await client.groupOrderMembers.create(groupOrderMember, {include: 'order'});
}

/**
 * Creates a new order for a given restaurant
 *
 * @param {Restaurant} restaurant
 * @return {Promise<T>}
 */
async function createOrder(restaurant) {
  const c = await client.clients.get(22347, {include: 'delivery-locations.location,owner'});

  let numWeeks = 1;
  let future = new Date();
  future.setDate(future.getDate() + numWeeks * 7);

  let order = new Order();
  // Attributes
  order.deliverAt = future;
  order.pickupAt = future;
  order.deadlineAt = future;
  order.numberOfPeople = 30;
  order.perPersonBudget = 3000;
  order.eventName = 'Test Event';


  // Relationships
  order.area = new Area(1);
  order.client = c;
  order.clientLocation = c.deliveryLocations[0].location;
  order.restaurantLocation = restaurant.pickupLocations[0].location;
  order.owner = c.owner;
  order.restaurant = restaurant;
  order.allowsGuests = true

  order = await client.orders.create(order, {include: 'area,client,restaurant,owner,client-location,restaurant-location'});

  order.stateEvent = 'publish';

  // NOTE Generated client doesn't support readonly attributes at present so we have to explicitly mark these undefined
  order.clientInvoicePdf = undefined;
  order.maxNumberOfPeople = undefined;
  order.totalAmount = undefined;

  order = await client.orders.update(order);

  return order;
}

async function doIt() {
  console.log('');
  console.log('Looking for an active Restaurant');
  const restaurants = await client.restaurants.index({filter: {active: true}, include: 'pickup-locations.location'});
  const restaurant = restaurants[0]
  const activeMenu = await client.restaurants.from(restaurant.id).get.activeMenu(1, {})

  console.log('');
  console.log('Found: ' + restaurant.name);
  console.log('Active Menu: ');
  const table = [];
  activeMenu.menuGroups.forEach((mg) => {
    table.push(
      {
        menu_group_id: mg.id,
        menu_item_id: null,
        menu_option_group_id: null,
        menu_option_item_id: null,
        name: mg.name.trim(),
        description: ellipsize(mg.description.trim()),
        restaurant_price: null,
        retail_price: null,
        client_price: null,
      }
    );

    mg.menuItems.forEach((mi) => {
      table.push(
        {
          menu_group_id: null,
          menu_item_id: mi.id,
          menu_option_group_id: null,
          menu_option_item_id: null,
          name: mg.name.trim(),
          description: ellipsize(mi.description.trim()),
          restaurant_price: mi.restaurantPriceCents,
          retail_price: mi.retailPriceCents,
          client_price: mi.clientPriceCents,
        }
      );

      mi.menuOptionGroups.forEach((mog) => {
        table.push(
          {
            menu_group_id: null,
            menu_item_id: null,
            menu_option_group_id: mog.id,
            menu_option_item_id: null,
            name: mog.verb.trim(),
            description: mog.name.trim()
          }
        );

        mog.menuOptionItems.forEach((moi) => {
          table.push(
            {
              menu_group_id: null,
              menu_item_id: null,
              menu_option_group_id: null,
              menu_option_item_id: moi.id,
              name: moi.name,
              description: null,
              restaurant_price: moi.restaurantPriceCents,
              retail_price: moi.retailPriceCents,
              client_price: moi.clientPriceCents,
            }
          )
        });
      });

      printTable(table);
    });
  });

  const order = await createOrder(restaurant);
  const groupOrderMember = await createGroupOrderMember(order);

  await createOrderItem(order, groupOrderMember, activeMenu.menuGroups[0].menuItems[0]);
  await createOrderItem(order, groupOrderMember, activeMenu.menuGroups[0].menuItems[1]);

  console.log(`Find the order at: https://app-staging.food.ee/team-order/${order.urlSafeId}`)
}

doIt();
